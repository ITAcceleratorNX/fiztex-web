import { useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Award, CalendarRange, Eye, Info, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { TextArea } from '@/components/ui/Field';
import type { FinalGrade } from '@/lib/gradebookApi';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { backTarget } from '@/lib/fillControlModel';
import { FillControlPanel } from '@/components/fillControl/FillControlPanel';
import { useFillControlSummary } from '@/hooks/fillControlQueries';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  useAssessmentSheets,
  useMarkNotTaken,
  useAttestationPeriods,
  useClassFinals,
  useGradebookContext,
  useJournal,
  useMyStudyAccess,
  usePublishClassFinals,
  useRepublishFinalGrade,
  useSaveAssessmentScores,
  useSetFinalGrade,
} from '@/hooks/queries';
import type { AttestationPeriodOption } from '@/lib/attestationSettingsApi';
import {
  attestationNote,
  deviationDialog,
  DEVIATION_REASONS,
  finalsBanner,
  finalsTabLabel,
  matchesRecommendation,
  NO_RECOMMENDATION_REASONS,
  optionOfPeriod,
  scopeWord,
} from '@/lib/finalsAttestationModel';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { DeviationReasonModal } from './DeviationReasonModal';
import { periodGenitive } from '@/lib/subjectAttestationModel';
import { saveErrorText } from './AttestationStatusModal';
import { StickyActionBar } from '@/components/ui/StickyActionBar';
import { useToast } from '@/context/ToastContext';
import { hasMeaningfulReason, REASON_MAX_LENGTH } from '@/lib/assessmentCorrectionModel';
import {
  barMessage,
  collectChanges,
  draftKey,
  needsReason,
  resultStateOf,
  scoreDraftProblem,
  type WorkSheet,
} from '@/lib/journalScoresModel';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { dotDate, endedAccessTo, extendedJournalNotice } from '@/lib/studyAccessModel';
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
import { AttestationStatusModal, ChangeFinalResultModal } from './AttestationStatusModal';
import {
  isAttestationStatus,
  PUBLISHED_EDIT_RULE,
  type AttestationKind,
  type ResultValue,
} from '@/lib/attestationModel';
import { finalValueOptions, QuarterFinalsTable } from './QuarterFinalsTable';

type JournalTab = 'JOURNAL' | 'FINALS' | 'YEAR_FINALS' | 'UNFILLED';

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
  // Свои дополнительные права нужны журналу только у учителя: объяснить, почему класс
  // недоступен (просмотр закончился), а не показать отказ как «другой учитель» (У4).
  const { admin } = useAuth();
  const myAccess = useMyStudyAccess(admin?.role === 'TEACHER');

  const scopes = useMemo(() => context?.scopes ?? [], [context]);
  const periods = useMemo(() => context?.periods ?? [], [context]);
  const months = useMemo(() => monthOptionsOf(periods), [periods]);

  const tab: JournalTab = params.get('tab') === 'year-finals' ? 'YEAR_FINALS' : params.get('tab') === 'finals' ? 'FINALS' : params.get('tab') === 'unfilled' ? 'UNFILLED' : 'JOURNAL';
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

  // «Итоговая аттестация по предметам»: у полугодового предмета фильтр «Период» на вкладке итогов —
  // полугодия, и открывается та четверть пары, где сейчас работа (`viewPeriodId` от сервера).
  const attestationPeriods = useAttestationPeriods(classId, subjectId);
  const attestationOptions = useMemo(() => attestationPeriods.data?.periods ?? [], [attestationPeriods.data]);
  const periodOption = optionOfPeriod(attestationOptions, periodId);
  const finalsPeriodId = tab === 'FINALS' && periodOption?.viewPeriodId != null ? periodOption.viewPeriodId : periodId;
  const finalsPeriodRefs = useMemo(() => attestationOptions
    .filter((option) => option.viewPeriodId != null)
    .map((option) => ({ id: option.viewPeriodId, name: option.name, startDate: option.startDate, endDate: option.endDate })),
  [attestationOptions]);
  const finalsFilter = tab === 'FINALS' && finalsPeriodRefs.length > 0;
  const subjectName = scopes.find((scope) => scope.classId === classId && scope.subjectId === subjectId)?.subjectName ?? '';
  const scope = scopes.find((item) => item.classId === classId && item.subjectId === subjectId);
  // Чужой класс из дополнительного права: только чтение и плашка со сроком (У1).
  const extendedScope = scope?.extended === true && scope.canEdit !== true ? scope : null;
  // Класс из адреса, которого больше нет в области журнала, а право на него закончилось (У4).
  const lockedAccess = classId != null && scopes.length > 0 && !scopes.some((item) => item.classId === classId)
    ? endedAccessTo(myAccess.data, classId, 'GRADES')
    : null;

  const ready = classId != null && subjectId != null && periodId != null && lockedAccess == null;
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
  const finalsKey = ready && finalsPeriodId != null
    ? { classId, subjectId, academicPeriodId: finalsPeriodId, subgroupId }
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

  const onTab = (next: JournalTab) =>
    patch({ tab: next === 'FINALS' ? 'finals' : next === 'YEAR_FINALS' ? 'year-finals' : next === 'UNFILLED' ? 'unfilled' : null });

  // «Незаполненное» не зависит от выбора класса и предмета журнала: список приходит от сервера
  // по области пользователя, поэтому ждать контекст журнала ему незачем.
  if (tab === 'UNFILLED') {
    return (
      <JournalShell tab={tab} onTab={onTab}>
        <FillControlPanel />
      </JournalShell>
    );
  }

  if (contextQuery.isPending) return <JournalSkeleton />;

  if (contextQuery.isError) {
    return (
      <JournalShell tab={tab} finalsLabel={finalsTabLabel(periodOption)} onTab={onTab}>
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
          {context?.academicYears?.map(year => (
            <option key={year.id} value={year.id} data-hint={year.extendedOnly ? 'только просмотр' : undefined}>
              {`${year.name}${year.status === 'ARCHIVED' ? ' · Архив' : ''}`}
            </option>
          ))}
        </Select>
      </label>
      {context?.academicYear?.status === 'ARCHIVED' && <p className="text-13 text-muted">Архивный журнал: только просмотр</p>}
    </div>
  ) : null;

  if (scopes.length === 0) {
    return (
      <JournalShell tab={tab} finalsLabel={finalsTabLabel(periodOption)} onTab={onTab}>
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
    <JournalShell tab={tab} finalsLabel={finalsTabLabel(periodOption)} onTab={onTab}>
      {yearPicker}
      <JournalFilters
        scopes={scopes}
        periods={finalsFilter ? finalsPeriodRefs : periods}
        months={months}
        subgroups={journal.data?.availableSubgroups ?? []}
        classId={classId}
        subjectId={subjectId}
        subgroupId={subgroupId}
        periodId={finalsFilter ? periodOption?.viewPeriodId ?? periodId : periodId}
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
        lockedClass={lockedAccess && classId != null ? { id: classId, name: lockedAccess.className } : null}
      />

      {extendedScope && tab !== 'YEAR_FINALS' && (
        <StatusNotice tone="navy" icon={Eye}>
          <strong className="font-bold">Дополнительный просмотр · только чтение.</strong>
          {extendedJournalNotice(extendedScope.className ?? '', extendedScope.extendedUntil)}
        </StatusNotice>
      )}

      {lockedAccess ? (
        <div className="card">
          <EmptyBlock
            icon={<Lock className="size-7" />}
            title={`Нет доступа к данным ${lockedAccess.className}`}
            description={`Дополнительный просмотр этого класса закончился ${dotDate(lockedAccess.grant.endedOn)}. Чтобы снова видеть оценки, обратитесь к администратору школы.`}
          />
        </div>
      ) : tab === 'JOURNAL' ? (
        <JournalTab query={journalQuery} journal={journal} finals={finals} readOnly={extendedScope != null} />
      ) : tab === 'YEAR_FINALS' ? (
        <YearFinalsTab key={`${context?.academicYear?.id}:${classId}:${subjectId}`} query={classId != null && subjectId != null && context?.academicYear?.id != null
          ? { classId, subjectId, academicYearId: context.academicYear.id } : null} />
      ) : (
        <FinalsTab key={`${classId}:${subjectId}:${finalsPeriodId}`} finalsKey={finalsKey} finals={finals}
          subjectName={subjectName} periodOption={periodOption} />
      )}
    </JournalShell>
  );
}

function JournalTab({
  query,
  journal,
  finals,
  readOnly = false,
}: {
  query: JournalQuery | null;
  journal: ReturnType<typeof useJournal>;
  finals: ReturnType<typeof useClassFinals>;
  /** Дополнительный просмотр: пустые клетки без «+» — выставить оценку здесь нельзя. */
  readOnly?: boolean;
}) {
  const [breakdown, setBreakdown] = useState<{ studentProfileId: number; name: string } | null>(null);
  const toast = useToast();
  const saveScores = useSaveAssessmentScores();
  const markNotTaken = useMarkNotTaken();
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
      canFill: data.canFill === true,
      fillBlockedMessage: data.fillBlockedMessage ?? null,
      students: new Map(
        (data.students ?? []).map((row) => [
          row.studentProfileId as number,
          {
            score: row.score ?? null,
            version: row.version ?? null,
            inAudience: row.inAudience !== false,
            state: resultStateOf(row.state, row.score),
          },
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
    state: (column, studentId) => sheets.get(column.sourceId as number)?.students.get(studentId)?.state ?? 'MISSING',
    canFill: (column) => sheets.get(column.sourceId ?? -1)?.canFill === true,
    fillBlockedMessage: (column) => sheets.get(column.sourceId ?? -1)?.fillBlockedMessage ?? null,
    // Одна команда на одного ученика: ошибка («работа не проведена», «четверть закрыта») идёт тостом,
    // клетка не меняется, а набранное в других клетках остаётся.
    markNotTaken: (column, studentId) => {
      setDraft(draftKey(column.sourceId as number, studentId), null);
      markNotTaken.mutate(
        { workId: column.sourceId as number, studentProfileId: studentId },
        {
          onSuccess: () => toast.success('Отмечено: не выполнял работу'),
          onError: (error) =>
            toast.error(error instanceof ApiError ? error.message : 'Не удалось отметить ученика'),
        },
      );
    },
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
      {/* В доп. просмотре оценки здесь не выставляют — приглашение к этому было бы неправдой. */}
      {!readOnly && !hasAnyMarks(rows) && (
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
          readOnly={readOnly}
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
  subjectName,
  periodOption,
}: {
  finalsKey: { classId: number; subjectId: number; academicPeriodId: number; subgroupId: number | null } | null;
  finals: ReturnType<typeof useClassFinals>;
  subjectName: string;
  periodOption: AttestationPeriodOption | null;
}) {
  const toast = useToast();
  const setFinal = useSetFinalGrade();
  const publish = usePublishClassFinals();
  const republish = useRepublishFinalGrade();
  const [busyStudentId, setBusyStudentId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Отказ действия в ячейке — под строкой ученика, а не внизу страницы (D-3).
  const [rowError, setRowError] = useState<{ studentProfileId: number; message: string } | null>(null);
  const [missing, setMissing] = useState<ReadonlySet<number>>(new Set());
  const [confirmPublish, setConfirmPublish] = useState(false);
  // «Редактировать» после публикации (макет Т5а, У10): замена ВНА оценкой и повторное подтверждение.
  const [editMode, setEditMode] = useState(false);
  const [statusRequest, setStatusRequest] = useState<{ row: ClassFinalGradeRow; kind: AttestationKind } | null>(null);
  const [changeRequest, setChangeRequest] = useState<{ row: ClassFinalGradeRow; initial: ResultValue | null } | null>(null);
  const [correctionRow, setCorrectionRow] = useState<ClassFinalGradeRow | null>(null);
  const [historyRow, setHistoryRow] = useState<ClassFinalGradeRow | null>(null);
  const [republishRow, setRepublishRow] = useState<ClassFinalGradeRow | null>(null);
  const [breakdown, setBreakdown] = useState<{ studentProfileId: number; name: string } | null>(null);
  // У4/У6: выбор, отличающийся от рекомендации (или без неё), ждёт основания.
  const [deviation, setDeviation] = useState<{
    row: ClassFinalGradeRow; kind: FinalGrade['resultKind'] & string; value: number | null; mode: 'pick' | 'republish';
  } | null>(null);
  const [deviationError, setDeviationError] = useState<string | null>(null);
  // У10: выбранный итог строки с изменившейся рекомендацией и основание, если он с ней не совпал.
  const [staged, setStaged] = useState<ReadonlyMap<number, { value: number; reason?: string }>>(new Map());

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
  const configured = Boolean(data.attestation?.configured);
  const confirmationRequired = Boolean(data.attestation?.confirmationRequired);
  const placement = { subjectId: finalsKey.subjectId, academicPeriodId: finalsKey.academicPeriodId, confirm: confirmationRequired };
  const filled = rows.filter((row) => row.finalGrade != null).length;
  const allFilled = rows.length > 0 && filled === rows.length;
  const hasPublicationIssues = rows.some(row => (!row.finalGrade?.resultKind || row.finalGrade.resultKind === 'NUMERIC') && (row.publicationIssues?.length ?? 0) > 0);
  const allPublished = rows.length > 0 && rows.every((row) => row.finalGrade?.status === 'PUBLISHED');
  const toReconfirm = configured ? rows.filter((row) => row.canConfirmPublication) : [];
  // Сервер разрешает строке замену опубликованного ВНА или повторное подтверждение — «Редактировать» есть что.
  const editable = rows.some((row) => row.canEditResult && row.finalGrade?.status === 'PUBLISHED') || toReconfirm.length > 0;
  const inEditMode = editMode && allPublished && editable;
  // Публиковать итоги можно только после окончания периода — дату считает сервер.
  const publicationOpen = data.publicationOpen !== false;
  const publishableFrom = data.publishableFrom ? formatShortDate(data.publishableFrom) : null;
  const scope = scopeWord(data);
  const periodName = periodOption?.name ?? (scope === 'полугодие' ? 'полугодия' : 'четверти');

  async function save(row: ClassFinalGradeRow, value: number | null, resultKind: FinalGrade['resultKind'], confirmationReason?: string) {
    await setFinal.mutateAsync({
      finalGradeId: row.finalGrade?.id ?? null,
      studentProfileId: row.studentProfileId as number,
      subjectId: finalsKey!.subjectId,
      academicPeriodId: finalsKey!.academicPeriodId,
      value, resultKind,
      expectedVersion: row.finalGrade?.version,
      confirm: confirmationRequired,
      confirmationReason,
    });
    setMissing((current) => {
      const next = new Set(current);
      next.delete(row.studentProfileId as number);
      return next;
    });
  }

  async function pick(row: ClassFinalGradeRow, value: number | null, resultKind: FinalGrade['resultKind'] = 'NUMERIC') {
    setError(null);
    setRowError(null);
    // Настроенный предмет: итог не как у рекомендации (или её нет) — сначала основание (У4, У6).
    if (confirmationRequired && !matchesRecommendation(row.recommendation, resultKind ?? 'NUMERIC', value)) {
      setDeviationError(null);
      setDeviation({ row, kind: resultKind ?? 'NUMERIC', value, mode: 'pick' });
      return;
    }
    setBusyStudentId(row.studentProfileId as number);
    try {
      await save(row, value, resultKind);
    } catch (failure) {
      setRowError({
        studentProfileId: row.studentProfileId as number,
        message: failure instanceof ApiError && failure.code === FINAL_GRADE_ERRORS.yearLocked
          ? 'Годовая оценка опубликована — четвертные по этому предмету закрыты'
          : failure instanceof ApiError
            ? failure.message
            : 'Не удалось сохранить итоговую оценку',
      });
    } finally {
      setBusyStudentId(null);
    }
  }

  async function saveDeviation(reason: string) {
    if (!deviation) return;
    setDeviationError(null);
    if (deviation.mode === 'republish') {
      setStaged((current) => new Map(current).set(deviation.row.studentProfileId as number, { value: deviation.value as number, reason }));
      setDeviation(null);
      return;
    }
    setBusyStudentId(deviation.row.studentProfileId as number);
    try {
      await save(deviation.row, deviation.value, deviation.kind, reason);
      setDeviation(null);
    } catch (failure) {
      setDeviationError(saveErrorText(failure));
    } finally {
      setBusyStudentId(null);
    }
  }

  function stageRepublish(row: ClassFinalGradeRow, value: number) {
    const id = row.studentProfileId as number;
    if (matchesRecommendation(row.recommendation, 'NUMERIC', value)) {
      setStaged((current) => new Map(current).set(id, { value }));
      return;
    }
    setDeviationError(null);
    setDeviation({ row, kind: 'NUMERIC', value, mode: 'republish' });
  }

  /** У10: «Подтвердить и опубликовать повторно» — все строки с изменившейся рекомендацией по очереди. */
  async function republishAll() {
    setError(null);
    const failures: string[] = [];
    for (const row of toReconfirm) {
      const grade = row.finalGrade;
      const choice = staged.get(row.studentProfileId as number);
      const value = choice?.value ?? (row.recommendation?.available ? row.recommendation.value : row.recommendedValue);
      if (grade?.id == null || grade.version == null || value == null) continue;
      try {
        await republish.mutateAsync({ id: grade.id, value, expectedVersion: grade.version, reason: choice?.reason });
      } catch (failure) {
        failures.push(`${row.studentName ?? ''}: ${saveErrorText(failure)}`);
      }
    }
    if (failures.length > 0) {
      setError(failures.join('\n'));
      return;
    }
    setStaged(new Map());
    setEditMode(false);
    toast.success('Итоги подтверждены и опубликованы повторно — ученик и родитель видят новые значения');
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
        setError(`Итоги выставлены не всем ученикам — опубликовать ${scope} нельзя`);
        return;
      }
      if (failure instanceof ApiError && failure.code === FINAL_GRADE_ERRORS.setNotConfirmed) {
        setMissing(new Set(incompleteStudentIdsFrom(failure.details)));
        setError('Не все итоги подтверждены: у отмеченных учеников выберите итог ещё раз — выбор и есть подтверждение');
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

  const note = attestationNote(data, subjectName);
  const banner = finalsBanner(data);
  // У кого уже стоит ВНА/НА, вопрос «чего не хватает расчёту» закрыт — их в сводке нет.
  const missingResults = !banner && data.gradingPolicy && data.attestation?.finalAllowed !== false
    ? missingResultsSummary(rows.filter((row) => !isAttestationStatus(row.finalGrade?.resultKind)).map((row) => row.result))
    : null;
  // Особые результаты без числа — «…» в ряду оценок и окно «Изменить итог» (Т4).
  const otherKinds = (data.allowedResultKinds ?? []).filter((kind) => kind !== 'NUMERIC' && !isAttestationStatus(kind)
    && (data.assessmentMode !== 'PASS_FAIL' || kind === 'NOT_STUDIED'));
  const changeRow = changeRequest?.row ?? null;
  const changingPublished = changeRow?.finalGrade?.status === 'PUBLISHED';
  const deviationText = deviation ? deviationDialog(deviation.row, deviation.kind, deviation.value) : null;

  return (
    <div className="flex flex-col gap-4">
      {note ? (
        <p className="flex items-start gap-2 px-1 text-13 text-slate-500">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{note}</span>
        </p>
      ) : <FinalsScaleNote finals={data} />}
      {banner && (banner.tone === 'warning' ? (
        <StatusNotice tone="warning"><strong>{banner.strong}</strong> {banner.text}</StatusNotice>
      ) : (
        <p role="status" className="rounded-lg bg-info-bg p-4 text-13 text-info-fg">{banner.text}</p>
      ))}
      {missingResults && missingResults.students > 0 && (
        <p role="status" className="rounded-lg bg-info-bg p-4 text-13 text-info-fg">
          Итог за {scope} не посчитан у {missingResults.students} из {rows.length}{' '}
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
          rowError={rowError}
          editMode={inEditMode}
          staged={new Map([...staged].map(([id, choice]) => [id, choice.value]))}
          actions={{
            onPickValue: (row, value) => void pick(row, value),
            onPickResult: (row, kind) => void pick(row, null, kind),
            onRequestStatus: (row, kind) => setStatusRequest({ row, kind }),
            onRequestChange: (row, initial) => setChangeRequest({ row, initial }),
            onOpenHistory: setHistoryRow,
            onCorrect: setCorrectionRow,
            onRepublish: setRepublishRow,
            onStageRepublish: stageRepublish,
            onOpenBreakdown: (row) =>
              setBreakdown({ studentProfileId: row.studentProfileId as number, name: row.studentName ?? '' }),
          }}
        />
      </div>

      {statusRequest && <AttestationStatusModal row={statusRequest.row} kind={statusRequest.kind}
        placement={placement} onClose={() => setStatusRequest(null)} />}
      {changeRow && <ChangeFinalResultModal row={changeRow} initial={changeRequest?.initial}
        values={changingPublished
          ? data.assessmentMode === 'PASS_FAIL' ? [] : (data.positiveValues?.length ? data.positiveValues : finalValueOptions(data))
          : data.assessmentMode === 'PASS_FAIL' ? [] : finalValueOptions(data)}
        otherKinds={changingPublished
          ? data.assessmentMode === 'PASS_FAIL' ? ['PASS'] : []
          : data.assessmentMode === 'PASS_FAIL' ? ['PASS', 'FAIL', ...otherKinds] : otherKinds}
        placement={placement} onClose={() => setChangeRequest(null)} />}
      {deviation && deviationText && (
        <DeviationReasonModal
          title={deviationText.title}
          subtitle={deviationText.subtitle}
          reasons={deviation.row.recommendation?.available ? DEVIATION_REASONS : NO_RECOMMENDATION_REASONS}
          placeholder={deviation.row.recommendation?.available
            ? 'Например: СОР 2 пересдан устно, есть справка' : 'Например: все работы сданы, нормативы выполнены'}
          busy={busyStudentId === deviation.row.studentProfileId}
          error={deviationError}
          onCancel={() => setDeviation(null)}
          onSave={(reason) => void saveDeviation(reason)}
        />
      )}
      {correctionRow?.finalGrade && <FinalGradeCorrectionModal grade={correctionRow.finalGrade}
        studentName={correctionRow.studentName ?? ''}
        allowedKinds={data.allowedResultKinds ?? ['NUMERIC']}
        allowedValues={finalValueOptions(data)} onClose={() => setCorrectionRow(null)} />}
      {republishRow?.finalGrade && <RepublishFinalModal grade={republishRow.finalGrade}
        recommended={republishRow.recommendedValue ?? null} studentName={republishRow.studentName ?? ''}
        options={finalValueOptions(data)}
        onClose={() => setRepublishRow(null)} />}
      {historyRow?.finalGrade?.id != null && <FinalGradeHistoryModal id={historyRow.finalGrade.id}
        studentName={historyRow.studentName ?? ''}
        context={[subjectName, periodOption?.name].filter(Boolean).join(' · ') || undefined}
        onClose={() => setHistoryRow(null)} />}
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
        <p className="whitespace-pre-line rounded-xl bg-danger-bg px-4 py-3 text-13 font-semibold text-red-600">
          {error}
        </p>
      )}

      {canManage && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5">
          <p className="flex items-center gap-3 text-13 text-slate-600">
            <span
              className={`size-2 shrink-0 rounded-full ${allPublished
                ? toReconfirm.length > 0 ? 'bg-brand-500' : 'bg-green-500'
                : allFilled && publicationOpen ? 'bg-navy-700' : 'bg-slate-300'}`}
            />
            {allPublished
              ? inEditMode
                ? toReconfirm.length > 0
                  ? 'Режим изменения: подтвердите итог с новой рекомендацией или замените ВНА на оценку'
                  : PUBLISHED_EDIT_RULE
                : toReconfirm.length > 0
                  ? `Итоги опубликованы. У ${toReconfirm.length} ${pluralRu(toReconfirm.length, ['ученика', 'учеников', 'учеников'])} изменилась рекомендация — подтвердите итог повторно`
                  : configured ? `Итоги ${periodOption?.name ? periodGenitive(periodOption.name) : periodName} опубликованы — их видят ученик и родитель`
                    : 'Итоги четверти опубликованы — их видят ученик и родитель'
              : !publicationOpen
                ? `Итоги можно выставлять уже сейчас, а опубликовать — после окончания ${scope === 'полугодие' ? 'полугодия' : 'четверти'}${publishableFrom ? `, с ${publishableFrom}` : ''} (${filled} из ${rows.length} выставлено)`
                : hasPublicationIssues
                  ? 'Внесите обязательные результаты работ или выберите особый результат для ученика'
                : allFilled
                  ? configured
                    ? 'Все итоги выставлены — можно публиковать. После публикации их увидят ученик и родитель'
                    : `Все итоги выставлены (${filled} из ${rows.length}) — можно публиковать`
                  : `Выставьте оценку всем ученикам, чтобы опубликовать итоги ${scope === 'полугодие' ? 'полугодия' : 'четверти'} (${filled} из ${rows.length} оценено)`}
          </p>
          {allPublished ? (
            inEditMode ? (
              <span className="flex gap-3">
                {toReconfirm.length > 0 && <Button variant="secondary" onClick={() => { setEditMode(false); setStaged(new Map()); }}>Отмена</Button>}
                {toReconfirm.length > 0
                  ? <Button loading={republish.isPending} onClick={() => void republishAll()}>Подтвердить и опубликовать повторно</Button>
                  : <Button onClick={() => setEditMode(false)}>Готово</Button>}
              </span>
            ) : <Button disabled={!editable} onClick={() => setEditMode(true)}>Редактировать</Button>
          ) : (
            <Button
              onClick={() => setConfirmPublish(true)}
              disabled={!allFilled || !publicationOpen || hasPublicationIssues}
              loading={publish.isPending}
            >
              {scope === 'полугодие' ? 'Опубликовать итоги полугодия' : 'Опубликовать итоги четверти'}
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmPublish}
        title={scope === 'полугодие' ? 'Опубликовать итоги полугодия?' : 'Опубликовать итоги четверти?'}
        message="После публикации итоговые оценки увидят ученики и родители. Изменить после публикации можно только «Временно не аттестован» на оценку — с причиной. Остальные итоги исправляет администратор по документам и протоколу."
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
  finalsLabel = 'Итоги четверти',
  onTab,
  children,
}: {
  tab: JournalTab;
  /** «Итоги полугодия» у полугодового предмета (макет Б1). */
  finalsLabel?: string;
  onTab: (tab: JournalTab) => void;
  children: React.ReactNode;
}) {
  // Число уроков на вкладке — тот же счётчик сервера, что внутри списка; без ответа вкладка без числа.
  const unfilled = useFillControlSummary({});
  // Пришли из «Незаполненного» — «← К незаполненным» возвращает тот же список с теми же фильтрами.
  const back = backTarget(useLocation().state);
  return (
    <div className="flex flex-col gap-5">
      {back && (
        <Link
          to={back.to}
          className="inline-flex items-center gap-1 self-start text-sm font-semibold text-navy-700 hover:text-navy-800"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {back.label.replace(/^←\s*/, '')}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-28 font-bold text-ink">Журнал</h1>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-13 font-medium text-slate-600">
          Сегодня: {formatWeekdayDayMonth(new Date())}
        </span>
      </div>

      <Tabs value={tab} onValueChange={(next) => onTab(next as JournalTab)}>
        <TabsList>
          <TabsTrigger value="JOURNAL">Журнал</TabsTrigger>
          <TabsTrigger value="FINALS">{finalsLabel}</TabsTrigger>
          <TabsTrigger value="YEAR_FINALS">Итоги года и экзамены</TabsTrigger>
          <TabsTrigger value="UNFILLED" count={unfilled.data?.lessons}>Незаполненное</TabsTrigger>
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
