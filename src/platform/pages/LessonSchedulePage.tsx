import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  Check,
  Copy,
  Loader2,
  Plus,
  Save,
  Users,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { scheduleSettingsApi } from '@/lib/scheduleSettingsApi';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import { cx } from '@/lib/format';
import {
  CopyScheduleModal,
  type CopyScheduleFormValues,
  type CopyStage,
} from './schedule/CopyScheduleModal';
import { EditScheduleDialog } from './schedule/EditScheduleDialog';
import { PublishConfirmDialog, type PublishStage } from './schedule/PublishConfirmDialog';
import { ScheduleConflictPanel } from './schedule/ScheduleConflictPanel';
import {
  ScheduleLessonFormModal,
  type LessonFormValues,
} from './schedule/ScheduleLessonFormModal';
import { ScheduleLegendBar, ScheduleWeeklyGrid } from './schedule/ScheduleWeeklyGrid';
import {
  archiveSchedule,
  checkSchedule,
  copySchedule,
  createDraftFromPublication,
  createSchedule,
  createScheduleLesson,
  deleteScheduleLesson,
  getConstructorContext,
  getSchedule,
  getScheduleGrid,
  listAcademicYears,
  listClasses,
  listPeriods,
  listScheduleHistory,
  listSchedules,
  publishSchedule,
  updateScheduleLesson,
  type ClassSchedule,
  type ConflictCheckReport,
  type ConflictFinding,
  type ConstructorContextView,
  type ScheduleGridView,
  type ScheduleHistoryRow,
  type ScheduleLesson,
} from '../services';
import type { AcademicPeriod, AcademicYear, SchoolClass } from '../types';

const SETTINGS_CARDS = [
  {
    to: '/admin/schedule-settings?tab=templates',
    label: 'Шаблоны звонков',
    icon: Bell,
  },
  {
    to: '/admin/schedule-settings?tab=calendar',
    label: 'Школьный календарь',
    icon: CalendarDays,
  },
  {
    to: '/admin/schedule-settings?tab=teachers',
    label: 'Занятость учителей',
    icon: UserCheck,
  },
  {
    to: '/admin/schedule-settings?tab=subgroups',
    label: 'Подгруппы классов',
    icon: Users,
  },
] as const;

/** Figma 2015:5831 — select в панели фильтров: gray-50, рамка, radius 8, 13px. */
const FILTER_CONTROL =
  'w-auto rounded-lg border-line bg-gray-50 px-3 py-2 text-13 font-medium text-ink';

/**
 * Кнопки панели по Figma 2015:4931 (режим редактирования) и 2015:5852 (просмотр).
 * Общая геометрия: radius 8, px 14 / py 8, 13px SemiBold, иконка 12px, gap 6.
 */
const PANEL_TONES = {
  /** btn-check 2015:4958 и btn-edit 2015:5852 — оранжевая заливка. */
  accent: 'bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-300',
  /** btn-save 2015:4954 — контур брендовым синим. */
  brand: 'border border-navy-700 text-navy-700 hover:bg-navy-50',
  /** btn-copy 2015:4956 и btn-publish 2015:4963 — серый контур. */
  muted: 'border border-line bg-white text-muted hover:bg-gray-50',
  /** Архива в макете нет — тихий вариант, чтобы не спорить с четвёркой из спеки. */
  ghost: 'text-muted hover:bg-gray-50',
} as const;

function PanelButton({
  tone = 'muted',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: keyof typeof PANEL_TONES;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-13 font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-60',
        PANEL_TONES[tone],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-3 shrink-0 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/**
 * Figma 2015:5364 — checking-central-card. В макете занимает место сетки,
 * а не накрывает её оверлеем: radius 16, p 60, круг 80 под спиннером 32.
 */
function CheckingCard() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-line bg-white p-[60px]">
      <span className="flex size-20 items-center justify-center rounded-full bg-gray-50">
        <Loader2 className="size-8 animate-spin text-navy-700" />
      </span>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-xl font-bold text-ink">Проверяем расписание...</p>
        <p className="text-sm text-muted">Это может занять несколько секунд</p>
      </div>
    </div>
  );
}

export function LessonSchedulePage() {
  const toast = useToast();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState('');
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classFilter, setClassFilter] = useState('');
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<ClassSchedule | null>(null);
  const [grid, setGrid] = useState<ScheduleGridView | null>(null);
  const [history, setHistory] = useState<ScheduleHistoryRow[]>([]);
  const [context, setContext] = useState<ConstructorContextView | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: number; name: string }>>([]);
  const [conflictReport, setConflictReport] = useState<ConflictCheckReport | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [lessonOpen, setLessonOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  /**
   * Экран открывается в режиме просмотра (Figma 2015:5786) — одна кнопка
   * «Редактировать». Для опубликованного расписания она сначала показывает
   * предупреждение (2015:17567), и только потом включается режим
   * редактирования с четырьмя кнопками (2015:4888).
   */
  const [editing, setEditing] = useState(false);
  const [editWarnOpen, setEditWarnOpen] = useState(false);
  /** Шаги мастера копирования и состояния публикации — см. макеты в самих компонентах. */
  const [copyStage, setCopyStage] = useState<CopyStage>('source');
  const [publishStage, setPublishStage] = useState<PublishStage>('confirm');
  const [createClassId, setCreateClassId] = useState('');
  const [createPeriodId, setCreatePeriodId] = useState('');
  const [bellTemplateId, setBellTemplateId] = useState('');
  const [pending, setPending] = useState(false);
  const [checkPending, setCheckPending] = useState(false);

  const [lessonMode, setLessonMode] = useState<'create' | 'edit'>('create');
  const [editingLesson, setEditingLesson] = useState<ScheduleLesson | null>(null);
  const [lockedSlot, setLockedSlot] = useState<{
    weekday: Weekday;
    lessonPeriodId: number;
  } | null>(null);

  useEffect(() => {
    void listAcademicYears()
      .then((y) => {
        setYears(y);
        const active = y.find((item) => item.status === 'ACTIVE') ?? y[0];
        if (active) setYearId(active.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'));
  }, []);

  useEffect(() => {
    if (!yearId) return;
    void Promise.all([
      listPeriods(yearId),
      listClasses({ academicYearId: yearId }),
      scheduleSettingsApi.listBellTemplates(Number(yearId)),
    ])
      .then(([p, c, tPage]) => {
        setPeriods(p);
        setClasses(c);
        setTemplates((tPage.content ?? []).map((t) => ({ id: t.id, name: t.name })));
        if (p[0]) {
          setPeriodId((prev) => prev || p[0].id);
          setCreatePeriodId((prev) => prev || p[0].id);
        }
        if (c[0]) {
          setClassFilter((prev) => prev || c[0].id);
          setCreateClassId((prev) => prev || c[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка метаданных'));
  }, [yearId]);

  const reloadSchedules = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listSchedules({
        academicYearId: Number(yearId),
        academicPeriodId: periodId ? Number(periodId) : undefined,
        classId: classFilter ? Number(classFilter) : undefined,
      });
      setSchedules(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить расписания');
    } finally {
      setLoading(false);
    }
  }, [yearId, periodId, classFilter]);

  useEffect(() => {
    void reloadSchedules();
  }, [reloadSchedules]);

  // Смена расписания возвращает экран в режим просмотра. Именно на selectedId,
  // а не в loadDetail: тот перевызывается после каждого сохранения урока.
  useEffect(() => {
    setEditing(false);
  }, [selectedId]);

  const loadDetail = useCallback(
    async (id: number) => {
      setSelectedId(id);
      setDetailLoading(true);
      setConflictReport(null);
      try {
        const [sched, gridView, hist] = await Promise.all([
          getSchedule(id),
          getScheduleGrid(id),
          listScheduleHistory(id),
        ]);
        setSelected(sched);
        setGrid(gridView);
        setHistory(hist);
        const ctx = await getConstructorContext({
          academicYearId: sched.academicYearId,
          classId: sched.classId,
          academicPeriodId: sched.academicPeriodId,
        });
        setContext(ctx);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Не удалось открыть расписание');
      } finally {
        setDetailLoading(false);
      }
    },
    [toast],
  );

  // Auto-pick schedule for selected year/period/class (prefer draft).
  useEffect(() => {
    if (!periodId || !classFilter || schedules.length === 0) {
      if (!loading && periodId && classFilter && schedules.length === 0) {
        setSelected(null);
        setSelectedId(null);
        setGrid(null);
      }
      return;
    }
    const classId = Number(classFilter);
    const period = Number(periodId);
    const match = schedules
      .filter((s) => s.classId === classId && s.academicPeriodId === period)
      .sort((a, b) => {
        const rank = (s: ClassSchedule) =>
          s.status === 'DRAFT' ? 0 : s.status === 'PUBLISHED' ? 1 : 2;
        return rank(a) - rank(b);
      })[0];
    if (match && match.id !== selectedId) {
      void loadDetail(match.id);
    }
  }, [schedules, periodId, classFilter, loading, selectedId, loadDetail]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const usePeriod = createPeriodId || periodId;
    const useClass = createClassId || classFilter;
    if (!yearId || !usePeriod || !useClass) {
      toast.error('Выберите год, период и класс');
      return;
    }
    setPending(true);
    try {
      const created = await createSchedule({
        academicYearId: Number(yearId),
        academicPeriodId: Number(usePeriod),
        classId: Number(useClass),
        bellTemplateId: bellTemplateId ? Number(bellTemplateId) : null,
      });
      toast.success('Расписание создано');
      setCreateOpen(false);
      setPeriodId(usePeriod);
      setClassFilter(useClass);
      await reloadSchedules();
      await loadDetail(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setPending(false);
    }
  }

  async function runConflictCheck(): Promise<ConflictCheckReport | null> {
    if (!selectedId) return null;
    setCheckPending(true);
    try {
      const report = await checkSchedule(selectedId);
      setConflictReport(report);
      return report;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка проверки');
      return null;
    } finally {
      setCheckPending(false);
    }
  }

  async function handleCheck() {
    const report = await runConflictCheck();
    if (!report) return;
    if (report.summary.criticalCount === 0 && report.summary.warningCount === 0) {
      toast.success('Конфликтов нет');
    } else if (report.summary.criticalCount > 0) {
      toast.error(`Критических конфликтов: ${report.summary.criticalCount}`);
    } else {
      toast.success(`Предупреждений: ${report.summary.warningCount}`);
    }
  }

  async function handlePublishClick() {
    const report = await runConflictCheck();
    if (!report) return;
    setPublishStage('confirm');
    setPublishOpen(true);
  }

  async function handleConfirmPublish(confirmedWarningCodes: string[]) {
    if (!selectedId || !conflictReport) return;
    setPending(true);
    try {
      await publishSchedule(selectedId, {
        expectedRevision: conflictReport.draftRevision,
        confirmedWarningCodes,
      });
      // Успех и отказ показываются в самой модалке (2015:17138 / 2015:17554),
      // а не тостом — так в макетах.
      setPublishStage('success');
      setConflictReport(null);
      // Расписание стало опубликованным — режим правки больше не действует.
      setEditing(false);
      await reloadSchedules();
      await loadDetail(selectedId);
    } catch (err) {
      if (err instanceof ApiError && err.details && typeof err.details === 'object') {
        const details = err.details as Partial<ConflictCheckReport>;
        if (details.criticals || details.warnings) {
          setConflictReport(details as ConflictCheckReport);
        }
      }
      setPublishStage('error');
    } finally {
      setPending(false);
    }
  }

  async function handleCreateDraft() {
    if (!selectedId) return;
    setPending(true);
    try {
      const draft = await createDraftFromPublication(selectedId);
      toast.success('Черновик создан на основе публикации');
      await reloadSchedules();
      await loadDetail(draft.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось создать черновик');
    } finally {
      setPending(false);
    }
  }

  /** Опубликованное расписание правится только через предупреждение (Figma 2015:17567). */
  function handleEditClick() {
    if (selected?.status === 'PUBLISHED') {
      setEditWarnOpen(true);
      return;
    }
    setEditing(true);
  }

  /** «Редактировать всё равно»: из публикации создаём черновик и открываем его на правку. */
  async function handleConfirmEdit() {
    await handleCreateDraft();
    setEditWarnOpen(false);
    setEditing(true);
  }

  async function handleArchive() {
    if (!selectedId || !window.confirm('Архивировать расписание?')) return;
    try {
      await archiveSchedule(selectedId);
      toast.success('Архивировано');
      setSelectedId(null);
      setSelected(null);
      setGrid(null);
      await reloadSchedules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleCopy(values: CopyScheduleFormValues) {
    if (!selectedId) return;
    setPending(true);
    try {
      const res = await copySchedule(selectedId, values);
      const warnMsg =
        res.warnings?.length > 0 ? ` · предупреждений: ${res.warnings.length}` : '';
      toast.success(`Скопировано уроков: ${res.copiedLessons}${warnMsg}`);
      setCopyOpen(false);
      if (values.targetClassId) setClassFilter(String(values.targetClassId));
      if (values.targetAcademicPeriodId) setPeriodId(String(values.targetAcademicPeriodId));
      await reloadSchedules();
      await loadDetail(res.schedule.id);
    } catch (err) {
      // 409 от копирования означает «в цели уже есть уроки» — показываем
      // состояние 2015:14646 с кнопкой «Заменить» вместо тоста.
      if (err instanceof ApiError && err.status === 409) {
        setCopyStage('conflict');
      } else {
        toast.error(err instanceof Error ? err.message : 'Ошибка копирования');
      }
    } finally {
      setPending(false);
    }
  }

  function openCreateLesson(slot?: { weekday: Weekday; lessonPeriodId: number }) {
    setLessonMode('create');
    setEditingLesson(null);
    setLockedSlot(slot ?? null);
    setLessonOpen(true);
  }

  /** «Перейти к слоту →» из баннера проверки открывает соответствующий урок или пустой слот. */
  function handleGoToSlot(finding: ConflictFinding) {
    if (!grid || !finding.weekday || finding.lessonNumber == null) return;
    const lesson = grid.lessons.find(
      (l) => l.weekday === finding.weekday && l.lessonNumber === finding.lessonNumber,
    );
    if (lesson) {
      openEditLesson(lesson);
      return;
    }
    const period = grid.periods.find((p) => p.lessonNumber === finding.lessonNumber);
    if (period) {
      openCreateLesson({ weekday: finding.weekday as Weekday, lessonPeriodId: period.id });
    }
  }

  function openEditLesson(lesson: ScheduleLesson) {
    setLessonMode('edit');
    setEditingLesson(lesson);
    setLockedSlot(null);
    setLessonOpen(true);
  }

  async function handleLessonSubmit(values: LessonFormValues) {
    if (!selectedId) return;
    setPending(true);
    try {
      const payload = {
        weekday: values.weekday,
        lessonPeriodId: values.lessonPeriodId,
        subjectId: values.subjectId,
        teacherId: values.teacherId,
        targetType: values.targetType,
        subgroupId: values.subgroupId,
        room: values.room,
      };
      const result =
        lessonMode === 'edit' && editingLesson
          ? await updateScheduleLesson(selectedId, editingLesson.id, payload)
          : await createScheduleLesson(selectedId, payload);
      if (result.warnings && result.warnings.length > 0) {
        toast.success(`Сохранено · ${result.warnings.map((w) => w.message).join('; ')}`);
      } else {
        toast.success(lessonMode === 'edit' ? 'Урок обновлён' : 'Урок добавлен');
      }
      setLessonOpen(false);
      setConflictReport(null);
      setSaveHint(`Все изменения сохранены · ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
      await loadDetail(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Конфликт или ошибка');
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteLesson() {
    if (!selectedId || !editingLesson) return;
    if (!window.confirm('Удалить урок?')) return;
    setPending(true);
    try {
      await deleteScheduleLesson(selectedId, editingLesson.id);
      toast.success('Урок удалён');
      setLessonOpen(false);
      setConflictReport(null);
      setSaveHint(`Все изменения сохранены · ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
      await loadDetail(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setPending(false);
    }
  }

  function handleSaveDraftClick() {
    if (!selectedId) return;
    void loadDetail(selectedId).then(() => {
      setSaveHint(
        `Все изменения сохранены · ${new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        })}`,
      );
      toast.success('Черновик актуален');
    });
  }

  const isDraft = selected?.status === 'DRAFT';
  const periodsForForm = grid?.periods ?? context?.bellTemplate?.periods ?? [];
  const canPublish =
    isDraft &&
    (!conflictReport || conflictReport.summary.criticalCount === 0);

  const yearName = years.find((y) => y.id === String(selected?.academicYearId))?.name;
  const periodName = periods.find((p) => p.id === String(selected?.academicPeriodId))?.name;
  const className = classes.find((c) => c.id === String(selected?.classId))?.name;

  const publishSummary = useMemo(() => {
    if (!selected) return undefined;
    return {
      year: yearName ?? '—',
      period: periodName ?? '—',
      className: className ?? '—',
      lessonCount: grid?.lessons.length ?? 0,
      publishedAt: `сегодня в ${new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
    };
  }, [selected, yearName, periodName, className, grid]);

  const matchedSchedules = useMemo(() => {
    if (!periodId || !classFilter) return schedules;
    return schedules.filter(
      (s) => s.classId === Number(classFilter) && s.academicPeriodId === Number(periodId),
    );
  }, [schedules, periodId, classFilter]);

  return (
    <div className="relative space-y-5">
      {/* Figma 2015:5790 — settings-block-container: заголовок 14px Bold, карточки 42px */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-ink">Настройки расписания</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SETTINGS_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.to}
                to={card.to}
                className="flex items-center justify-between gap-2.5 rounded-lg border border-line bg-white p-3 transition hover:border-navy-700"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon className="size-4 shrink-0 text-navy-700" />
                  <span className="truncate text-13 font-semibold text-ink">{card.label}</span>
                </span>
                <span className="shrink-0 rounded bg-success-bg px-2 py-0.5 text-11 font-semibold text-success-fg">
                  Настроено
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Figma 2015:5829 — top-control-panel: radius 12, p 16, тень 0 4px 6px /.03 */}
      <section className="rounded-xl bg-white p-4 shadow-panel">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <Select
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
              className={FILTER_CONTROL}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
            <Select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className={FILTER_CONTROL}
            >
              <option value="">Период</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className={FILTER_CONTROL}
            >
              <option value="">Класс</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <div className="rounded-lg border border-line bg-gray-50 px-3 py-2 text-13 font-medium text-ink">
              {selected?.bellTemplateName ?? 'Шаблон звонков'}
            </div>
          </div>

          {/* Просмотр — одна кнопка (2015:5852). Редактирование — четыре (2015:4953). */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!selected && periodId && classFilter && (
              <PanelButton
                tone="accent"
                icon={<Plus className="size-3 shrink-0" />}
                onClick={() => {
                  setCreateClassId(classFilter);
                  setCreatePeriodId(periodId);
                  setCreateOpen(true);
                }}
              >
                Создать
              </PanelButton>
            )}

            {selected && selected.status !== 'ARCHIVED' && !editing && (
              <PanelButton tone="accent" loading={pending} onClick={handleEditClick}>
                Редактировать
              </PanelButton>
            )}

            {selected && editing && (
              <>
                <PanelButton
                  tone="brand"
                  icon={<Save className="size-3 shrink-0" />}
                  onClick={handleSaveDraftClick}
                >
                  Сохранить черновик
                </PanelButton>
                <PanelButton
                  tone="muted"
                  icon={<Copy className="size-3 shrink-0" />}
                  onClick={() => {
                    setCopyStage('source');
                    setCopyOpen(true);
                  }}
                >
                  Копировать
                </PanelButton>
                <PanelButton
                  tone="accent"
                  loading={checkPending}
                  icon={<Check className="size-3 shrink-0" />}
                  onClick={() => void handleCheck()}
                >
                  Проверить
                </PanelButton>
                <PanelButton
                  tone="muted"
                  disabled={!canPublish || checkPending}
                  onClick={() => void handlePublishClick()}
                >
                  Опубликовать
                </PanelButton>
                {/* Архива в макете нет, но это единственный доступ к архивации. */}
                <PanelButton tone="ghost" onClick={() => void handleArchive()}>
                  Архив
                </PanelButton>
              </>
            )}
          </div>
        </div>
      </section>

      {saveHint && (
        <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          {saveHint}
        </div>
      )}

      {loading && <LoadingBlock />}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void reloadSchedules()} />}

      {!loading && !error && (
        <>
          <ScheduleConflictPanel
            report={conflictReport}
            periods={grid?.periods}
            className={className}
            onGoToSlot={handleGoToSlot}
          />

          <ScheduleLegendBar />

          {checkPending ? (
            <CheckingCard />
          ) : detailLoading ? (
            <LoadingBlock />
          ) : !selected ? (
            <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
              <EmptyBlock
                title={
                  periodId && classFilter
                    ? 'Расписание ещё не создано'
                    : 'Выберите период и класс'
                }
                description={
                  periodId && classFilter
                    ? 'Создайте черновик для выбранного класса и периода.'
                    : 'Укажите учебный год, период и класс в панели выше.'
                }
              />
              {periodId && classFilter && matchedSchedules.length === 0 && (
                <Button
                  className="mt-4"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => {
                    setCreateClassId(classFilter);
                    setCreatePeriodId(periodId);
                    setCreateOpen(true);
                  }}
                >
                  Создать расписание
                </Button>
              )}
            </div>
          ) : !grid || grid.periods.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-14 text-center">
              <h3 className="text-lg font-semibold text-navy-900">
                Сначала назначьте шаблон звонков для этого класса
              </h3>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                Шаблон звонков определяет количество уроков и их время. Без него невозможно
                построить расписание.
              </p>
              <Link
                to="/admin/schedule-settings?tab=templates"
                className="mt-5 inline-flex h-10 items-center rounded-xl bg-navy-700 px-4 text-sm font-semibold text-white hover:bg-navy-800"
              >
                Перейти к шаблонам
              </Link>
            </div>
          ) : (
            <ScheduleWeeklyGrid
              grid={grid}
              readOnly={!(isDraft && editing)}
              criticals={conflictReport?.criticals}
              warnings={conflictReport?.warnings}
              onAddSlot={(weekday, periodIdSlot) =>
                openCreateLesson({ weekday, lessonPeriodId: periodIdSlot })
              }
              onEditLesson={openEditLesson}
            />
          )}

          {selected && history.length > 0 && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer select-none font-medium text-slate-600">
                История изменений
              </summary>
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                {history.map((h) => (
                  <li key={h.id}>
                    {h.actionType} · {h.createdAt}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Создать расписание"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate} loading={pending}>
              Создать
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Класс" required>
            <Select
              value={createClassId}
              onChange={(e) => setCreateClassId(e.target.value)}
              required
            >
              <option value="">Выберите</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Период" required>
            <Select
              value={createPeriodId}
              onChange={(e) => setCreatePeriodId(e.target.value)}
              required
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Шаблон звонков">
            <Select value={bellTemplateId} onChange={(e) => setBellTemplateId(e.target.value)}>
              <option value="">По умолчанию класса</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Modal>

      <ScheduleLessonFormModal
        open={lessonOpen}
        onClose={() => setLessonOpen(false)}
        onSubmit={handleLessonSubmit}
        onDelete={lessonMode === 'edit' ? handleDeleteLesson : undefined}
        pending={pending}
        mode={lessonMode}
        initial={editingLesson}
        lockedSlot={lockedSlot}
        periods={periodsForForm}
        context={context}
        weekdays={grid?.weekdays}
      />

      {selected && (
        <CopyScheduleModal
          open={copyOpen}
          stage={copyStage}
          onStageChange={setCopyStage}
          onClose={() => setCopyOpen(false)}
          onSubmit={handleCopy}
          pending={pending}
          periods={periods}
          classes={classes}
          templates={templates}
          sourceClassId={selected.classId}
          sourceGroupSets={context?.groupSets ?? []}
          sourceYearName={yearName}
          sourcePeriodName={periodName}
          sourceClassName={className}
        />
      )}

      <EditScheduleDialog
        open={editWarnOpen}
        className={classes.find((c) => c.id === String(selected?.classId))?.name}
        pending={pending}
        onClose={() => setEditWarnOpen(false)}
        onConfirm={() => void handleConfirmEdit()}
      />

      <PublishConfirmDialog
        open={publishOpen}
        stage={publishStage}
        report={conflictReport}
        summary={publishSummary}
        loading={pending}
        onClose={() => setPublishOpen(false)}
        onConfirm={(codes) => void handleConfirmPublish(codes)}
        // «Повторить» возвращает к подтверждению, а не публикует сразу:
        // при наличии предупреждений их нужно подтвердить заново чекбоксом.
        onRetry={() => setPublishStage('confirm')}
      />
    </div>
  );
}
