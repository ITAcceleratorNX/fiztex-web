import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { ErrorBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { cx, pluralRu } from '@/lib/format';
import {
  parseScheduleWorkbook,
  type ParsedWorkbook,
} from '@/lib/scheduleImport/parseScheduleWorkbook';
import {
  planProvisioning,
  type ProvisioningPlan,
} from '@/lib/scheduleImport/planProvisioning';
import {
  EMPTY_OVERRIDES,
  resolveScheduleImport,
  type ClassContext,
  type ImportOverrides,
  type ResolvedImport,
  type SchoolCatalogs,
} from '@/lib/scheduleImport/resolveScheduleImport';
import { readXlsxWorkbook, XlsxReadError } from '@/lib/xlsx/readWorkbook';
import { getConstructorContext, listAcademicYears, listPeriods } from '@/platform/services';
import type { AcademicPeriod, AcademicYear } from '@/platform/types';
import {
  runScheduleImport,
  type ClassImportResult,
  type ExistingDraftMode,
  type ImportProgress,
} from '@/platform/services/scheduleImport';
import {
  runProvisioning,
  type ProvisionItemResult,
  type ProvisionProgress,
} from '@/platform/services/scheduleImportProvisioning';
import { ScheduleImportClasses } from './ScheduleImportClasses';
import { ScheduleImportProblems } from './ScheduleImportProblems';
import {
  ScheduleImportProvisioning,
  type ProvisionKinds,
} from './ScheduleImportProvisioning';

/** Больше 15 МБ школьное расписание не бывает — дальше это чужой файл. */
const MAX_BYTES = 15 * 1024 * 1024;
/** Контекстов классов одновременно: у каждого свой запрос за звонком и подгруппами. */
const CONTEXT_CONCURRENCY = 6;

type Stage = 'upload' | 'review' | 'running' | 'done';

async function loadClassContexts(
  academicYearId: number,
  academicPeriodId: number,
  fileNames: string[],
  matchClass: (fileName: string) => { id: number } | null,
): Promise<Map<string, ClassContext>> {
  const contexts = new Map<string, ClassContext>();
  const targets = fileNames
    .map((fileName) => ({ fileName, matched: matchClass(fileName) }))
    .filter((item): item is { fileName: string; matched: { id: number } } => item.matched != null);

  let cursor = 0;
  async function worker() {
    for (;;) {
      const index = cursor++;
      const target = targets[index];
      if (!target) return;
      try {
        const context = await getConstructorContext({
          academicYearId,
          academicPeriodId,
          classId: target.matched.id,
        });
        contexts.set(target.fileName, {
          bellTemplateId: context.bellTemplate?.id ?? null,
          bellTemplateName: context.bellTemplate?.name ?? null,
          periods: context.bellTemplate?.periods ?? [],
          groupSets: context.groupSets ?? [],
        });
      } catch {
        // Класс без контекста станет проблемой «нет шаблона звонков» — молчать нельзя,
        // но и валить весь разбор из-за одного класса тоже.
        contexts.set(target.fileName, {
          bellTemplateId: null,
          bellTemplateName: null,
          periods: [],
          groupSets: [],
        });
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONTEXT_CONCURRENCY, targets.length) }, worker),
  );
  return contexts;
}

/** Справочники школы и контекст каждого класса файла — одним вызовом. */
async function loadCatalogs(
  academicYearId: number,
  academicPeriodId: number,
  fileClassNames: string[],
): Promise<{ school: SchoolCatalogs; contexts: Map<string, ClassContext> }> {
  const context = await getConstructorContext({ academicYearId, academicPeriodId });
  const school: SchoolCatalogs = {
    classes: context.classes,
    subjects: context.subjects,
    teachers: context.teachers,
  };
  const normalize = (name: string) => name.toLowerCase().replace(/[\s.]/g, '');
  const byName = new Map(school.classes.map((item) => [normalize(item.name), item]));
  const contexts = await loadClassContexts(
    academicYearId,
    academicPeriodId,
    fileClassNames,
    (name) => byName.get(normalize(name)) ?? null,
  );
  return { school, contexts };
}

/**
 * Загрузка расписания школы из Excel.
 *
 * Файл разбирается в браузере, а записывается теми же запросами, что и ручной
 * конструктор. Так между «что увидел администратор» и «что уйдёт в базу» нет
 * серверного шага, который никто не смотрел: отчёт о проблемах построен ровно по
 * тем строкам, которые потом станут уроками.
 *
 * Экран ничего не пишет до нажатия кнопки. Разбор, сопоставление и отчёт живут в
 * памяти вкладки, поэтому «загрузил не тот файл» стоит одну перезагрузку страницы,
 * а не откат импорта.
 */
export function ScheduleImportPage() {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState('');
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [periodId, setPeriodId] = useState('');

  const [stage, setStage] = useState<Stage>('upload');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [catalogs, setCatalogs] = useState<SchoolCatalogs | null>(null);
  const [classContexts, setClassContexts] = useState<Map<string, ClassContext>>(new Map());
  const [overrides, setOverrides] = useState<ImportOverrides>(EMPTY_OVERRIDES);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draftMode, setDraftMode] = useState<ExistingDraftMode>('skip');

  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [results, setResults] = useState<Map<string, ClassImportResult>>(new Map());

  const [provisionKinds, setProvisionKinds] = useState<ProvisionKinds>({
    subject: true,
    class: true,
    bellTemplate: true,
    subgroups: true,
  });
  const [provisioning, setProvisioning] = useState(false);
  const [provisionProgress, setProvisionProgress] = useState<ProvisionProgress | null>(null);
  const [provisionResults, setProvisionResults] = useState<ProvisionItemResult[]>([]);

  useEffect(() => {
    void listAcademicYears()
      .then((list) => {
        setYears(list);
        const active = list.find((year) => year.status === 'ACTIVE') ?? list[0];
        if (active) setYearId(active.id);
      })
      .catch(() => setError('Не удалось загрузить учебные годы'));
  }, []);

  useEffect(() => {
    if (!yearId) {
      setPeriods([]);
      setPeriodId('');
      return;
    }
    void listPeriods(yearId)
      .then((list) => {
        setPeriods(list);
        setPeriodId((current) => (list.some((p) => p.id === current) ? current : list[0]?.id ?? ''));
      })
      .catch(() => setError('Не удалось загрузить учебные периоды'));
  }, [yearId]);

  const resolved: ResolvedImport | null = useMemo(() => {
    if (!parsed || !catalogs) return null;
    return resolveScheduleImport(parsed.lessons, catalogs, classContexts, overrides);
  }, [parsed, catalogs, classContexts, overrides]);

  const provisioningPlan: ProvisioningPlan | null = useMemo(() => {
    if (!parsed || !catalogs) return null;
    return planProvisioning(parsed.lessons, catalogs, classContexts);
  }, [parsed, catalogs, classContexts]);

  // Готовность класса меняется от каждой правки в отчёте — держим выбор в согласии
  // с ней, иначе кнопка импорта считала бы классы, которые снова стали ошибочными.
  useEffect(() => {
    if (!resolved) return;
    setSelected((current) => {
      const ready = new Set(resolved.plans.filter((plan) => plan.ready).map((p) => p.className));
      const next = new Set([...current].filter((name) => ready.has(name)));
      return next.size === current.size ? current : next;
    });
  }, [resolved]);

  const handleFile = useCallback(
    async (file: File | null) => {
      setError(null);
      if (!file) return;
      if (!/\.xlsx$/i.test(file.name)) {
        setError('Нужен файл .xlsx — старый формат .xls браузер не читает');
        return;
      }
      if (file.size > MAX_BYTES) {
        setError('Файл больше 15 МБ — вряд ли это расписание');
        return;
      }
      if (!yearId || !periodId) {
        setError('Сначала выберите учебный год и период');
        return;
      }

      setBusy(true);
      setFileName(file.name);
      try {
        const workbook = await readXlsxWorkbook(await file.arrayBuffer());
        const parsedWorkbook = parseScheduleWorkbook(workbook);
        if (parsedWorkbook.lessons.length === 0) {
          setError(
            'В файле не нашлось ни одного урока. Ожидается лист, где строка с днём недели ' +
              'объявляет колонки классов, а ниже идут время, номер урока и пары «предмет — кабинет».',
          );
          setBusy(false);
          return;
        }

        const { school, contexts } = await loadCatalogs(
          Number(yearId),
          Number(periodId),
          [...new Set(parsedWorkbook.lessons.map((lesson) => lesson.className))],
        );

        setParsed(parsedWorkbook);
        setCatalogs(school);
        setClassContexts(contexts);
        setOverrides(EMPTY_OVERRIDES);
        setResults(new Map());
        setStage('review');
      } catch (readError) {
        setError(
          readError instanceof XlsxReadError
            ? readError.message
            : readError instanceof Error
              ? readError.message
              : 'Не удалось прочитать файл',
        );
      } finally {
        setBusy(false);
      }
    },
    [yearId, periodId],
  );

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files?.[0] ?? null);
  }

  function applyOverride(kind: keyof ImportOverrides, key: string, id: number | null) {
    setOverrides((current) => {
      const next = { ...current, [kind]: { ...current[kind] } };
      if (id == null) delete next[kind][key];
      else next[kind][key] = id;
      return next;
    });
  }

  async function runProvisioningStep() {
    if (!provisioningPlan || !parsed || !catalogs) return;
    setProvisioning(true);
    setError(null);
    const normalize = (name: string) => name.toLowerCase().replace(/[\s.]/g, '');
    const classIdByName = new Map(catalogs.classes.map((item) => [normalize(item.name), item.id]));
    try {
      const done = await runProvisioning(provisioningPlan, {
        academicYearId: Number(yearId),
        kinds: provisionKinds,
        resolveClassId: (name) => classIdByName.get(normalize(name)) ?? null,
        onProgress: setProvisionProgress,
      });
      setProvisionResults(done);

      // Справочники перечитываем целиком: у созданного класса появился и звонок, и
      // подгруппы, и досчитать это по ответам создания значило бы держать вторую
      // версию того, что уже отдаёт `constructor-context`.
      const { school, contexts } = await loadCatalogs(
        Number(yearId),
        Number(periodId),
        [...new Set(parsed.lessons.map((lesson) => lesson.className))],
      );
      setCatalogs(school);
      setClassContexts(contexts);

      const failed = done.filter((item) => !item.ok).length;
      if (failed > 0) toast.error(`Создано ${done.length - failed} из ${done.length}`);
      else if (done.length > 0) toast.success(`Создано: ${done.length}`);
    } catch (provisionError) {
      setError(
        provisionError instanceof Error ? provisionError.message : 'Не удалось создать сущности',
      );
    } finally {
      setProvisioning(false);
      setProvisionProgress(null);
    }
  }

  async function startImport() {
    if (!resolved) return;
    const plans = resolved.plans.filter((plan) => plan.ready && selected.has(plan.className));
    if (plans.length === 0) return;

    setStage('running');
    setResults(new Map());
    try {
      const done = await runScheduleImport(plans, {
        academicYearId: Number(yearId),
        academicPeriodId: Number(periodId),
        existingDraftMode: draftMode,
        onProgress: setProgress,
      });
      setResults(new Map(done.map((result) => [result.className, result])));
      const created = done.reduce((sum, result) => sum + result.created, 0);
      const failed = done.filter((result) => result.outcome === 'failed').length;
      if (failed > 0) {
        toast.error(`Импортировано уроков: ${created}. Классов с ошибками: ${failed}`);
      } else {
        toast.success(`Импортировано уроков: ${created} в ${done.length} классов`);
      }
      setStage('done');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Импорт не завершился');
      setStage('review');
    } finally {
      setProgress(null);
    }
  }

  const selectedLessons = useMemo(() => {
    if (!resolved) return 0;
    return resolved.plans
      .filter((plan) => selected.has(plan.className))
      .reduce((sum, plan) => sum + plan.lessons.length, 0);
  }, [resolved, selected]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          to="/lesson-schedule"
          className="inline-flex items-center gap-1.5 text-13 font-semibold text-muted hover:text-navy-700"
        >
          <ArrowLeft className="size-4" /> Расписание
        </Link>
      </div>

      <section className="rounded-xl bg-white p-4 shadow-panel">
        <h1 className="text-15 font-bold text-ink">Загрузка расписания из Excel</h1>
        <p className="mt-1 max-w-3xl text-13 text-muted">
          Файл читается как сетка: строка с днём недели объявляет колонки классов, ниже идут
          время, номер урока и пары «предмет — кабинет». Класс, разделённый на группы, занимает
          две колонки («5ә-1», «5ә-2»); одинаковые ячейки в них означают урок всего класса.
          Уроки попадают в черновики — опубликованное расписание импорт не трогает.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Select
            value={yearId}
            onChange={(event) => setYearId(event.target.value)}
            className="h-9 w-48"
            disabled={stage !== 'upload'}
          >
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </Select>
          <Select
            value={periodId}
            onChange={(event) => setPeriodId(event.target.value)}
            className="h-9 w-48"
            disabled={stage !== 'upload'}
          >
            <option value="">Период</option>
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name}
              </option>
            ))}
          </Select>
        </div>
      </section>

      {error && <ErrorBlock message={error} />}

      {stage === 'upload' && (
        <section
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx(
            'card flex flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-14 text-center transition',
            dragging ? 'border-brand-400 bg-brand-50/40' : 'border-line',
          )}
        >
          <FileSpreadsheet className="size-8 text-navy-700" />
          <div className="text-13 font-semibold text-ink">
            Перетащите .xlsx с расписанием или выберите файл
          </div>
          <div className="text-11 text-muted">
            Все листы книги читаются сразу: по листу на параллель — обычный случай
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
          />
          <Button
            onClick={() => inputRef.current?.click()}
            loading={busy}
            disabled={!yearId || !periodId}
            icon={<Upload className="size-4" />}
          >
            Выбрать файл
          </Button>
          {!periodId && (
            <div className="text-11 text-red-600">Выберите учебный период — без него не с чем связать уроки</div>
          )}
        </section>
      )}

      {stage !== 'upload' && resolved && parsed && (
        <>
          <section className="card grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label="Файл" value={fileName ?? '—'} />
            <Stat label="Листов" value={String(parsed.sheets.length)} />
            <Stat label="Уроков в файле" value={String(resolved.totals.lessons)} />
            <Stat
              label="Готово к импорту"
              value={`${resolved.totals.ready} в ${resolved.totals.classesReady} классах`}
              tone={resolved.totals.ready > 0 ? 'ok' : undefined}
            />
            <Stat
              label="Требует правки"
              value={`${resolved.totals.blocked} в ${resolved.totals.classesBlocked} классах`}
              tone={resolved.totals.blocked > 0 ? 'warn' : undefined}
            />
          </section>

          {provisioningPlan && (
            <ScheduleImportProvisioning
              plan={provisioningPlan}
              kinds={provisionKinds}
              onKindsChange={setProvisionKinds}
              onRun={() => void runProvisioningStep()}
              running={provisioning}
              progress={provisionProgress}
              results={provisionResults}
            />
          )}

          <ScheduleImportProblems
            problems={resolved.problems}
            overrides={overrides}
            onOverride={applyOverride}
          />

          <ScheduleImportClasses
            plans={resolved.plans}
            selected={selected}
            onToggle={(className) =>
              setSelected((current) => {
                const next = new Set(current);
                if (next.has(className)) next.delete(className);
                else next.add(className);
                return next;
              })
            }
            onToggleAll={(checked) =>
              setSelected(
                checked
                  ? new Set(resolved.plans.filter((plan) => plan.ready).map((p) => p.className))
                  : new Set(),
              )
            }
            results={results}
          />

          <section className="rounded-xl bg-white p-4 shadow-panel">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-13 text-ink">
                  <input
                    type="radio"
                    name="draft-mode"
                    checked={draftMode === 'skip'}
                    onChange={() => setDraftMode('skip')}
                  />
                  Пропускать классы с непустым черновиком
                </label>
                <label className="flex items-center gap-2 text-13 text-ink">
                  <input
                    type="radio"
                    name="draft-mode"
                    checked={draftMode === 'replace'}
                    onChange={() => setDraftMode('replace')}
                  />
                  Заменять уроки в черновике
                </label>
              </div>

              <div className="flex items-center gap-3">
                {stage === 'running' && progress && (
                  <span className="inline-flex items-center gap-2 text-13 text-muted">
                    <Loader2 className="size-4 animate-spin" />
                    {progress.className}: {progress.lessonsDone}/{progress.lessonsTotal} · класс{' '}
                    {progress.classIndex + 1} из {progress.classCount}
                  </span>
                )}
                <Button
                  onClick={() => void startImport()}
                  loading={stage === 'running'}
                  disabled={selected.size === 0 || stage === 'running'}
                >
                  {`Импортировать: ${selected.size} ${pluralRu(selected.size, [
                    'класс',
                    'класса',
                    'классов',
                  ])}, ${selectedLessons} ${pluralRu(selectedLessons, [
                    'урок',
                    'урока',
                    'уроков',
                  ])}`}
                </Button>
              </div>
            </div>
            {draftMode === 'replace' && (
              <p className="mt-2 text-11 text-red-600">
                Уроки существующих черновиков выбранных классов будут удалены перед записью.
              </p>
            )}
          </section>
        </>
      )}

      {stage === 'done' && (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="text-13 text-ink">
            Импорт завершён. Черновики открываются в конструкторе — там же проверка конфликтов и
            публикация.
          </div>
          <Link
            to="/lesson-schedule"
            className="text-13 font-semibold text-navy-700 hover:underline"
          >
            Открыть расписание
          </Link>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn';
}) {
  return (
    <div className="min-w-0">
      <div className="text-11 uppercase tracking-wide text-muted">{label}</div>
      {/* Имя файла длиннее колонки — переносим по словам, полное отдаём подсказкой. */}
      <div
        title={value}
        className={cx(
          'mt-0.5 break-words text-13 font-semibold leading-snug',
          tone === 'ok' ? 'text-success-fg' : tone === 'warn' ? 'text-red-600' : 'text-ink',
        )}
      >
        {value}
      </div>
    </div>
  );
}
