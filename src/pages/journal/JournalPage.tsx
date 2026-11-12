import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, CalendarRange, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { TextArea } from '@/components/ui/Field';
import type { FinalGrade } from '@/lib/gradebookApi';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  useAssessmentSheets,
  useClassFinals,
  useGradebookContext,
  useJournal,
  usePublishClassFinals,
  useSaveAssessmentScores,
  useSetFinalGrade,
} from '@/hooks/queries';
import { StickyActionBar } from '@/components/ui/StickyActionBar';
import { useToast } from '@/context/ToastContext';
import { hasMeaningfulReason, REASON_MAX_LENGTH } from '@/lib/assessmentCorrectionModel';
import {
  barMessage,
  collectChanges,
  draftKey,
  needsReason,
  scoreDraftProblem,
  type WorkSheet,
} from '@/lib/journalScoresModel';
import { ApiError } from '@/lib/api';
import { formatWeekdayDayMonth, pluralRu } from '@/lib/format';
import {
  FINAL_GRADE_ERRORS,
  incompleteStudentIdsFrom,
  type ClassFinalGradeRow,
  type ClassFinalGrades,
  type JournalQuery,
} from '@/lib/gradebookApi';
import {
  currentMonthKey,
  finalsByStudent,
  hasAnyMarks,
  isAssessmentColumn,
  monthOptionsOf,
  shortDate as formatShortDate,
} from '@/lib/journalModel';
import { finalScaleCaption, missingResultsSummary, weightsCaption } from '@/lib/gradingModel';
import { JournalFilters, type JournalWindow } from './JournalFilters';
import { JournalTable, type ScoreEditor } from './JournalTable';
import { PeriodBreakdownModal } from './PeriodBreakdownModal';
import { YearFinalsTab } from './YearFinalsTab';
import { FinalGradeCorrectionModal, FinalGradeHistoryModal, RepublishFinalModal } from './FinalGradeCorrectionModal';
import { FINAL_VALUES, QuarterFinalsTable } from './QuarterFinalsTable';

type JournalTab = 'JOURNAL' | 'FINALS' | 'YEAR_FINALS';

/**
 * Журнал оценок и итоги четверти (Figma 2098:428, 2098:1324).
 *
 * <p><b>Ничего не считает.</b> Средние, рекомендации и признак «можно ли выставлять»
 * приходят с сервера (GRADEBOOK-001 §5, GRADEBOOK-002 §4, §8): у учителя, ученика и
 * бэкенда обязана быть одна арифметика, а второй расчёт на клиенте разошёлся бы с ней в
 * первый же день.
 *
 * <p><b>Журнал — зеркало, а не второе место правки.</b> Оценка ставится на уроке, где у
 * неё есть источник и автор; пустая клетка здесь ведёт в этот урок. Итоги четверти —
 * наоборот, живут только тут: у них нет своего урока.
 *
 * <p>Состояние фильтров лежит в адресе: журнал открывают ссылкой из чата завуча не реже,
 * чем руками.
 */
export function JournalPage() {
  useDocumentTitle('Журнал');

  const [params, setParams] = useSearchParams();
  const contextQuery = useGradebookContext(true, numberParam(params.get('yearId')));
  const context = contextQuery.data;

  const scopes = useMemo(() => context?.scopes ?? [], [context]);
  const periods = useMemo(() => context?.periods ?? [], [context]);
  const months = useMemo(() => monthOptionsOf(periods), [periods]);

  const tab: JournalTab = params.get('tab') === 'year-finals' ? 'YEAR_FINALS' : params.get('tab') === 'finals' ? 'FINALS' : 'JOURNAL';
  // «Месяц» — окно внутри четверти, поэтому у итогов его нет: итог выставляют за четверть.
  const window: JournalWindow = params.get('window') === 'month' ? 'MONTH' : 'PERIOD';

  const classId = numberParam(params.get('classId')) ?? scopes[0]?.classId ?? null;
  const subjectId =
    numberParam(params.get('subjectId')) ??
    scopes.find((scope) => scope.classId === classId)?.subjectId ??
    null;
  const subgroupId = numberParam(params.get('subgroupId'));
  const monthKey = params.get('month') ?? currentMonthKey(months) ?? months[0]?.key ?? null;
  const month = months.find((option) => option.key === monthKey) ?? null;

  const periodId =
    window === 'MONTH' && month
      ? month.academicPeriodId
      : (numberParam(params.get('periodId')) ??
        periods.find((period) => period.current)?.id ??
        periods[0]?.id ??
        null);

  const ready = classId != null && subjectId != null && periodId != null;
  const journalQuery: JournalQuery | null = ready
    ? {
        classId,
        subjectId,
        academicPeriodId: periodId,
        subgroupId,
        dateFrom: window === 'MONTH' ? month?.dateFrom : null,
        dateTo: window === 'MONTH' ? month?.dateTo : null,
      }
    : null;
  const finalsKey = ready
    ? { classId, subjectId, academicPeriodId: periodId, subgroupId }
    : null;

  const journal = useJournal(tab === 'JOURNAL' ? journalQuery : null);
  const finals = useClassFinals(finalsKey);

  function patch(next: Record<string, string | number | null>) {
    const updated = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') updated.delete(key);
      else updated.set(key, String(value));
    }
    setParams(updated, { replace: true });
  }

  if (contextQuery.isPending) return <JournalSkeleton />;

  if (contextQuery.isError) {
    return (
      <JournalShell tab={tab} onTab={(next) => patch({ tab: next === 'FINALS' ? 'finals' : next === 'YEAR_FINALS' ? 'year-finals' : null })}>
        <div className="card">
          <ErrorBlock
            message={
              contextQuery.error instanceof ApiError && contextQuery.error.status === 403
                ? 'Журнал доступен учителю предмета и администратору'
                : 'Не удалось загрузить журнал. Проверьте подключение к интернету и попробуйте ещё раз'
            }
            onRetry={() => void contextQuery.refetch()}
          />
        </div>
      </JournalShell>
    );
  }

  const yearPicker = (context?.academicYears?.length ?? 0) > 0 ? (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-3 text-13 font-semibold text-muted">Учебный год
        <Select aria-label="Учебный год журнала" value={String(context?.academicYear?.id ?? '')}
          onChange={event => patch({ yearId: event.target.value, classId: null, subjectId: null, periodId: null, subgroupId: null, month: null })}>
          {!context?.academicYear && <option value="">Выберите год</option>}
          {context?.academicYears?.map(year => <option key={year.id} value={year.id}>{`${year.name}${year.status === 'ARCHIVED' ? ' · Архив' : ''}`}</option>)}
        </Select>
      </label>
      {context?.academicYear?.status === 'ARCHIVED' && <p className="text-13 text-muted">Архивный журнал: только просмотр</p>}
    </div>
  ) : null;

  if (scopes.length === 0) {
    return (
      <JournalShell tab={tab} onTab={(next) => patch({ tab: next === 'FINALS' ? 'finals' : next === 'YEAR_FINALS' ? 'year-finals' : null })}>
        {yearPicker}
        <div className="card">
          <EmptyBlock
            icon={<Info className="size-7" />}
            title="Журнал пока не по чему открыть"
            description={
              context?.academicYear
                ? 'Ни один предмет в классе за вами не закреплён — обратитесь к администратору школы'
                : 'В школе нет активного учебного года — журнал появится, когда его заведут'
            }
          />
        </div>
      </JournalShell>
    );
  }

  return (
    <JournalShell tab={tab} onTab={(next) => patch({ tab: next === 'FINALS' ? 'finals' : next === 'YEAR_FINALS' ? 'year-finals' : null })}>
      {yearPicker}
      <JournalFilters
        scopes={scopes}
        periods={periods}
        months={months}
        subgroups={journal.data?.availableSubgroups ?? []}
        classId={classId}
        subjectId={subjectId}
        subgroupId={subgroupId}
        periodId={periodId}
        monthKey={monthKey}
        window={window}
        showWindowToggle={tab === 'JOURNAL'}
        showPeriod={tab !== 'YEAR_FINALS'}
        onChangeClass={(next) => patch({ classId: next, subjectId: null, subgroupId: null })}
        onChangeSubgroup={(next) => patch({ subgroupId: next })}
        onChangeSubject={(next) => patch({ subjectId: next })}
        onChangePeriod={(next) => patch({ periodId: next })}
        onChangeMonth={(next) => patch({ month: next })}
        onChangeWindow={(next) => patch({ window: next === 'MONTH' ? 'month' : null })}
      />

      {tab === 'JOURNAL' ? (
        <JournalTab query={journalQuery} journal={journal} finals={finals} />
      ) : tab === 'YEAR_FINALS' ? (
        <YearFinalsTab key={`${context?.academicYear?.id}:${classId}:${subjectId}`} query={classId != null && subjectId != null && context?.academicYear?.id != null
          ? { classId, subjectId, academicYearId: context.academicYear.id } : null} />
      ) : (
        <FinalsTab key={`${classId}:${subjectId}:${periodId}`} finalsKey={finalsKey} finals={finals} />
      )}
    </JournalShell>
  );
}

function JournalTab({
  query,
  journal,
  finals,
}: {
  query: JournalQuery | null;
  journal: ReturnType<typeof useJournal>;
  finals: ReturnType<typeof useClassFinals>;
}) {
  const [breakdown, setBreakdown] = useState<{ studentProfileId: number; name: string } | null>(null);
  const toast = useToast();
  const saveScores = useSaveAssessmentScores();
  /** Несохранённые баллы работ: ключ «работа:ученик» → текст поля. */
  const [drafts, setDrafts] = useState<ReadonlyMap<string, string>>(new Map());
  const [reasonOpen, setReasonOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Листы результатов работ, которые есть в журнале: из них берём право править и версии.
  const workIds = (journal.data?.columns ?? [])
    .filter((column) => isAssessmentColumn(column) && column.assessmentStatus !== 'CANCELLED' && column.sourceId != null)
    .map((column) => column.sourceId as number);
  const sheetQueries = useAssessmentSheets(workIds);
  const sheets = new Map<number, WorkSheet>();
  workIds.forEach((workId, index) => {
    const data = sheetQueries[index]?.data;
    if (!data) return;
    sheets.set(workId, {
      workId,
      kind: data.work?.kind ?? 'SOR',
      maxScore: data.work?.maxScore ?? 0,
      canManage: Boolean(data.canManage),
      students: new Map(
        (data.students ?? []).map((row) => [
          row.studentProfileId as number,
          { score: row.score ?? null, version: row.version ?? null, inAudience: row.inAudience !== false },
        ]),
      ),
    });
  });
  const { changes, invalid } = collectChanges(drafts, sheets);

  function setDraft(key: string, text: string | null) {
    setDrafts((current) => {
      const next = new Map(current);
      if (text == null) next.delete(key);
      else next.set(key, text);
      return next;
    });
  }

  const editor: ScoreEditor | undefined = sheets.size === 0 ? undefined : {
    canEdit: (column) => sheets.get(column.sourceId ?? -1)?.canManage === true,
    draft: (column, studentId) => drafts.get(draftKey(column.sourceId as number, studentId)),
    problem: (column, studentId) => {
      const sheet = sheets.get(column.sourceId as number);
      const text = drafts.get(draftKey(column.sourceId as number, studentId));
      return sheet && text !== undefined ? scoreDraftProblem(text, sheet.maxScore) : null;
    },
    saved: (column, studentId) => sheets.get(column.sourceId as number)?.students.get(studentId)?.score ?? null,
    change: (column, studentId, text) => setDraft(draftKey(column.sourceId as number, studentId), text),
    // Пустое или совпавшее с сохранённым поле — не правка: поле закрывается без следа.
    blur: (column, studentId) => {
      const key = draftKey(column.sourceId as number, studentId);
      const text = (drafts.get(key) ?? '').trim();
      const saved = sheets.get(column.sourceId as number)?.students.get(studentId)?.score ?? null;
      if (text === '' || (saved != null && text === String(saved))) setDraft(key, null);
    },
  };

  async function save(reason?: string) {
    setSaveError(null);
    setReasonOpen(false);
    try {
      const result = await saveScores.mutateAsync({ changes, reason });
      // Сохранённые уходят из черновиков; упавшие остаются, чтобы их можно было поправить и повторить.
      setDrafts((current) => {
        const next = new Map(current);
        result.saved.forEach((key) => next.delete(key));
        return next;
      });
      if (result.failed.length === 0) {
        toast.success(result.saved.length === 1 ? 'Балл сохранён' : 'Баллы сохранены');
      } else {
        setSaveError(
          `Сохранено ${result.saved.length} из ${result.saved.length + result.failed.length}. ${result.failed[0].message}`,
        );
      }
    } catch {
      setSaveError('Не удалось сохранить баллы');
    }
  }

  function requestSave() {
    if (changes.length === 0 || invalid.length > 0) return;
    if (needsReason(changes)) setReasonOpen(true);
    else void save();
  }

  if (query == null || journal.isPending) return <TableSkeleton />;

  if (journal.isError) {
    return (
      <div className="card">
        <ErrorBlock
          message={
            journal.error instanceof ApiError && journal.error.status === 403
              ? 'Этот предмет в этом классе ведёт другой учитель'
              : 'Не удалось загрузить журнал. Проверьте подключение к интернету и попробуйте ещё раз'
          }
          onRetry={() => void journal.refetch()}
        />
      </div>
    );
  }

  const data = journal.data;
  const columns = data?.columns ?? [];
  const rows = data?.rows ?? [];

  if (columns.length === 0) {
    return (
      <div className="card">
        <EmptyBlock
          icon={<CalendarRange className="size-7" />}
          title="Нет данных за выбранный период"
          description="Выбранный период ещё не начался или для этого класса нет уроков"
        />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card">
        <EmptyBlock
          icon={<Award className="size-7" />}
          title="В классе нет учеников"
          description="Проверьте состав класса и выбранную подгруппу"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!hasAnyMarks(rows) && (
        <p role="status" className="rounded-lg bg-info-bg p-4 text-13 text-info-fg">
          Оценок пока нет. Откройте урок по дате в заголовке таблицы, чтобы выставить первые оценки.
        </p>
      )}
      <div className="card overflow-hidden p-0">
        <JournalTable
          journal={data!}
          finals={finalsByStudent(finals.data?.rows ?? [])}
          today={todayIso()}
          editor={editor}
          onOpenBreakdown={(row) =>
            setBreakdown({ studentProfileId: row.studentProfileId as number, name: row.studentName ?? '' })
          }
        />
      </div>
      {(changes.length > 0 || invalid.length > 0 || saveError) && (
        <StickyActionBar
          message={
            saveError ? (
              <span role="alert" className="text-danger-fg">{saveError}</span>
            ) : (
              <span className={invalid.length > 0 ? 'text-danger-fg' : undefined}>{barMessage(changes, invalid.length)}</span>
            )
          }
        >
          <Button
            variant="ghost"
            disabled={saveScores.isPending}
            onClick={() => {
              setDrafts(new Map());
              setSaveError(null);
            }}
          >
            Отменить
          </Button>
          <Button
            loading={saveScores.isPending}
            disabled={changes.length === 0 || invalid.length > 0}
            onClick={requestSave}
          >
            Сохранить баллы
          </Button>
        </StickyActionBar>
      )}
      {reasonOpen && <ScoreReasonModal busy={saveScores.isPending} onClose={() => setReasonOpen(false)} onConfirm={(reason) => void save(reason)} />}
      <Legend policyCaption={data?.gradingPolicy ? weightsCaption(data.gradingPolicy.components) : null} />
      <PeriodBreakdownModal
        query={
          breakdown && query
            ? {
                studentProfileId: breakdown.studentProfileId,
                subjectId: query.subjectId,
                academicPeriodId: query.academicPeriodId,
              }
            : null
        }
        studentName={breakdown?.name}
        onClose={() => setBreakdown(null)}
      />
    </div>
  );
}

function FinalsTab({
  finalsKey,
  finals,
}: {
  finalsKey: { classId: number; subjectId: number; academicPeriodId: number; subgroupId: number | null } | null;
  finals: ReturnType<typeof useClassFinals>;
}) {
  const setFinal = useSetFinalGrade();
  const publish = usePublishClassFinals();
  const [busyStudentId, setBusyStudentId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<ReadonlySet<number>>(new Set());
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [reasonRow, setReasonRow] = useState<ClassFinalGradeRow | null>(null);
  const [correctionRow, setCorrectionRow] = useState<ClassFinalGradeRow | null>(null);
  const [historyRow, setHistoryRow] = useState<ClassFinalGradeRow | null>(null);
  const [republishRow, setRepublishRow] = useState<ClassFinalGradeRow | null>(null);
  const [reason, setReason] = useState('');
  const [breakdown, setBreakdown] = useState<{ studentProfileId: number; name: string } | null>(null);

  if (finalsKey == null || finals.isPending) return <TableSkeleton />;

  if (finals.isError) {
    return (
      <div className="card">
        <ErrorBlock
          message={
            finals.error instanceof ApiError && finals.error.status === 403
              ? 'Этот предмет в этом классе ведёт другой учитель'
              : 'Не удалось загрузить итоги. Проверьте подключение к интернету и попробуйте ещё раз'
          }
          onRetry={() => void finals.refetch()}
        />
      </div>
    );
  }

  const data = finals.data!;
  const rows = data.rows ?? [];
  const canManage = Boolean(data.canManage);
  const filled = rows.filter((row) => row.finalGrade != null).length;
  const allFilled = rows.length > 0 && filled === rows.length;
  const hasPublicationIssues = rows.some(row => (!row.finalGrade?.resultKind || row.finalGrade.resultKind === 'NUMERIC') && (row.publicationIssues?.length ?? 0) > 0);
  const allPublished =
    rows.length > 0 && rows.every((row) => row.finalGrade?.status === 'PUBLISHED');
  // Публиковать итоги можно только после окончания четверти — дату считает сервер.
  const publicationOpen = data.publicationOpen !== false;
  const publishableFrom = data.publishableFrom ? formatShortDate(data.publishableFrom) : null;

  async function pick(row: ClassFinalGradeRow, value: number | null, resultKind: FinalGrade['resultKind'] = 'NUMERIC', resultReason?: string) {
    setError(null);
    setBusyStudentId(row.studentProfileId as number);
    try {
      await setFinal.mutateAsync({
        finalGradeId: row.finalGrade?.id ?? null,
        studentProfileId: row.studentProfileId as number,
        subjectId: finalsKey!.subjectId,
        academicPeriodId: finalsKey!.academicPeriodId,
        value, resultKind, resultReason,
      });
      setMissing((current) => {
        const next = new Set(current);
        next.delete(row.studentProfileId as number);
        return next;
      });
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.code === FINAL_GRADE_ERRORS.yearLocked
          ? 'Годовая оценка опубликована — четвертные по этому предмету закрыты'
          : failure instanceof ApiError
            ? failure.message
            : 'Не удалось сохранить итоговую оценку',
      );
    } finally {
      setBusyStudentId(null);
    }
  }

  async function publishAll() {
    setError(null);
    setConfirmPublish(false);
    try {
      await publish.mutateAsync(finalsKey!);
      setMissing(new Set());
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === FINAL_GRADE_ERRORS.periodNotEnded) {
        setError(failure.message);
        return;
      }
      if (failure instanceof ApiError && failure.code === FINAL_GRADE_ERRORS.setIncomplete) {
        setMissing(new Set(incompleteStudentIdsFrom(failure.details)));
        setError('Итоги выставлены не всем ученикам — опубликовать четверть нельзя');
        return;
      }
      setError(failure instanceof ApiError ? failure.message : 'Не удалось опубликовать итоги');
    }
  }

  if (data.assessmentMode === 'NO_ASSESSMENT') {
    return <div className="card p-6"><p className="font-semibold text-ink">В 1 классе учебные достижения не оцениваются</p><p className="mt-2 text-13 text-muted">Используйте комментарии и обратную связь. Числовые и зачётные итоги не выставляются.</p></div>;
  }

  if (rows.length === 0) {
    return (
      <div className="card">
        <EmptyBlock
          icon={<Info className="size-7" />}
          title="В классе нет учеников"
          description="Проверьте состав класса или подгруппы у администратора"
        />
      </div>
    );
  }

  const missingResults = data.gradingPolicy ? missingResultsSummary(rows.map((row) => row.result)) : null;

  return (
    <div className="flex flex-col gap-4">
      <FinalsScaleNote finals={data} />
      {missingResults && missingResults.students > 0 && (
        <p role="status" className="rounded-lg bg-info-bg p-4 text-13 text-info-fg">
          Итог за четверть не посчитан у {missingResults.students} из {rows.length}{' '}
          {pluralRu(rows.length, ['ученика', 'учеников', 'учеников'])}
          {missingResults.components.length > 0 ? `: нет ${missingResults.components.join(', ')}` : ': нет работ'}.
          {' '}Внесите работы на уроках или, если обязательная работа не сдана, выберите «Временно не аттестован».
        </p>
      )}
      <div className="card overflow-hidden p-0">
        <QuarterFinalsTable
          finals={data}
          highlighted={missing}
          busyStudentId={busyStudentId}
          onPick={(row, value) => void pick(row, value)}
          onCorrect={setCorrectionRow}
          onOpenHistory={setHistoryRow}
          onRepublish={setRepublishRow}
          onPickResult={(row, kind) => {
            if (kind === 'NOT_STUDIED') { setReasonRow(row); setReason(''); }
            else void pick(row, null, kind);
          }}
          onOpenBreakdown={(row) =>
            setBreakdown({ studentProfileId: row.studentProfileId as number, name: row.studentName ?? '' })
          }
        />
      </div>

      {correctionRow?.finalGrade && <FinalGradeCorrectionModal grade={correctionRow.finalGrade}
        studentName={correctionRow.studentName ?? ''} allowedKinds={data.allowedResultKinds ?? ['NUMERIC']}
        onClose={() => setCorrectionRow(null)} />}
      {republishRow?.finalGrade && republishRow.recommendedValue != null && <RepublishFinalModal grade={republishRow.finalGrade}
        recommended={republishRow.recommendedValue} studentName={republishRow.studentName ?? ''}
        options={data.allowedValues && data.allowedValues.length > 0 ? data.allowedValues : [...FINAL_VALUES]}
        onClose={() => setRepublishRow(null)} />}
      {historyRow?.finalGrade?.id != null && <FinalGradeHistoryModal id={historyRow.finalGrade.id}
        studentName={historyRow.studentName ?? ''} onClose={() => setHistoryRow(null)} />}
      <Modal open={reasonRow != null} onClose={() => setReasonRow(null)} title="Предмет не изучался">
        <p className="text-13 text-muted">Укажите основание, например перевод из школы, где этот предмет не изучался. Результат сохранится в истории.</p>
        <label className="mt-4 block text-13 font-semibold">Основание
          <TextArea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} />
        </label>
        <div className="mt-4 flex justify-end gap-3"><Button variant="secondary" onClick={() => setReasonRow(null)}>Отмена</Button>
          <Button disabled={reason.trim().length < 5} onClick={() => { if (reasonRow) void pick(reasonRow, null, 'NOT_STUDIED', reason.trim()).then(() => setReasonRow(null)); }}>Сохранить результат</Button></div>
      </Modal>
      <PeriodBreakdownModal
        query={
          breakdown
            ? {
                studentProfileId: breakdown.studentProfileId,
                subjectId: finalsKey.subjectId,
                academicPeriodId: finalsKey.academicPeriodId,
              }
            : null
        }
        studentName={breakdown?.name}
        onClose={() => setBreakdown(null)}
      />

      {error && (
        <p className="rounded-xl bg-danger-bg px-4 py-3 text-13 font-semibold text-red-600">
          {error}
        </p>
      )}

      {canManage && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5">
          <p className="flex items-center gap-3 text-13 text-slate-600">
            <span
              className={`size-2 shrink-0 rounded-full ${allPublished ? 'bg-green-500' : allFilled && publicationOpen ? 'bg-brand-500' : 'bg-slate-300'}`}
            />
            {allPublished
              ? 'Итоги четверти опубликованы — их видят ученик и родитель'
              : !publicationOpen
                ? `Итоги можно выставлять уже сейчас, а опубликовать — после окончания четверти${publishableFrom ? `, с ${publishableFrom}` : ''} (${filled} из ${rows.length} выставлено)`
                : hasPublicationIssues
                  ? 'Внесите обязательные результаты работ или выберите особый результат для ученика'
                : allFilled
                  ? `Все итоги выставлены (${filled} из ${rows.length}) — можно публиковать`
                  : `Выставьте оценку всем ученикам, чтобы опубликовать итоги четверти (${filled} из ${rows.length} оценено)`}
          </p>
          <Button
            onClick={() => setConfirmPublish(true)}
            disabled={!allFilled || allPublished || !publicationOpen || hasPublicationIssues}
            loading={publish.isPending}
          >
            Опубликовать итоги четверти
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmPublish}
        title="Опубликовать итоги четверти?"
        message="После публикации итоговые оценки увидят ученики и родители. Обычная правка будет закрыта. Техническую ошибку исправляет администратор по документам и протоколу; временная неаттестация завершается после сдачи обязательных работ."
        confirmLabel="Опубликовать"
        loading={publish.isPending}
        onConfirm={() => void publishAll()}
        onClose={() => setConfirmPublish(false)}
      />
    </div>
  );
}

function JournalShell({
  tab,
  onTab,
  children,
}: {
  tab: JournalTab;
  onTab: (tab: JournalTab) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-28 font-bold text-ink">Журнал</h1>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-13 font-medium text-slate-600">
          Сегодня: {formatWeekdayDayMonth(new Date())}
        </span>
      </div>

      <Tabs value={tab} onValueChange={(next) => onTab(next as JournalTab)}>
        <TabsList>
          <TabsTrigger value="JOURNAL">Журнал</TabsTrigger>
          <TabsTrigger value="FINALS">Итоги четверти</TabsTrigger>
          <TabsTrigger value="YEAR_FINALS">Итоги года и экзамены</TabsTrigger>
        </TabsList>
        {/* Отступ между фильтрами и таблицей: без него карточка таблицы прилипала к полям. */}
        <TabsContent value={tab} className="mt-5 flex flex-col gap-5">
          {children}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Откуда какое число (пилот, пункт 3.1): на уроке 10-балльная ФО, у СОР и СОЧ — баллы из
 * максимума работы, итог — по порогам политики. Без подписи 1–10 урока и 2–5 итога
 * (в четверти по прежней шкале) выглядели одной сломанной шкалой.
 */
function FinalsScaleNote({ finals }: { finals: ClassFinalGrades }) {
  const scale = finalScaleCaption(finals.allowedValues);
  const policy = finals.gradingPolicy;
  if (finals.assessmentMode && finals.assessmentMode !== 'NUMERIC') return null;
  return (
    <p className="flex items-start gap-2 px-1 text-13 text-slate-500">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        {policy ? (
          <>
            Итог четверти — оценка {scale ?? ''} по порогам политики «{policy.name}». Процент считается по весам{' '}
            {weightsCaption(policy.components)}: ФО — 10-балльная (1–10), СОР и СОЧ — баллы из максимума работы
            (например, 15/20).
          </>
        ) : (
          <>Четверть без политики оценивания: итог {scale ?? '2–5'} по среднему баллу, как в журнале этой четверти.</>
        )}
      </span>
    </p>
  );
}

function Legend({ policyCaption }: { policyCaption: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-6 px-1 text-13 text-slate-500">
      {policyCaption && (
        <span className="flex items-center gap-2 font-medium text-slate-600">
          Четверть по политике оценивания: {policyCaption}
        </span>
      )}
      <span className="flex items-center gap-2">
        <span className="flex size-[26px] items-center justify-center rounded-lg bg-navy-700 text-13 font-bold text-white">
          4
        </span>
        Выставленная оценка
      </span>
      <span className="flex items-center gap-2">
        <span className="size-4 rounded bg-navy-50" />
        Сегодняшний урок
      </span>
      <span className="flex items-center gap-2">
        <span className="text-13 font-semibold text-slate-400">01.09</span>
        Урок отменён или из прежней версии расписания — оценки сохранены, новые не ставятся
      </span>
    </div>
  );
}

function JournalSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy="true" aria-label="Загрузка журнала">
      <div className="h-8 w-40 rounded bg-slate-200" />
      <div className="h-10 w-64 rounded bg-slate-200/70" />
      <div className="h-14 rounded-xl bg-slate-200/60" />
      <div className="h-96 rounded-2xl bg-slate-200/50" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="h-96 animate-pulse rounded-2xl bg-slate-200/50" aria-busy="true" aria-label="Загрузка таблицы" />
  );
}

function numberParam(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Причина исправления выставленного СОЧ (ТЗ «Исправление результатов СОЧ»): одна на все
 * исправления СОЧ в пачке. Пустая и бессодержательная не принимаются — сервер проверяет так же.
 */
function ScoreReasonModal({
  busy,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open
      size="sm"
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Причина исправления СОЧ"
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>Отмена</Button>
          <Button loading={busy} disabled={!hasMeaningfulReason(reason)} onClick={() => onConfirm(reason.trim())}>
            Сохранить баллы
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-slate-600">
        <p>Прежний балл, причина, автор и время сохранятся в истории. Опубликованный итог четверти не изменится.</p>
        <label className="text-13 font-semibold text-slate-900">
          Причина
          <TextArea value={reason} maxLength={REASON_MAX_LENGTH} onChange={(event) => setReason(event.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
