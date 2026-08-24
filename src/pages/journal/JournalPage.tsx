import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, CalendarRange, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  useClassFinals,
  useGradebookContext,
  useJournal,
  usePublishClassFinals,
  useSetFinalGrade,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { formatWeekdayDayMonth } from '@/lib/format';
import {
  FINAL_GRADE_ERRORS,
  incompleteStudentIdsFrom,
  type ClassFinalGradeRow,
  type JournalQuery,
} from '@/lib/gradebookApi';
import { currentMonthKey, finalsByStudent, monthOptionsOf } from '@/lib/journalModel';
import { JournalFilters, type JournalWindow } from './JournalFilters';
import { JournalTable } from './JournalTable';
import { QuarterFinalsTable } from './QuarterFinalsTable';

type JournalTab = 'JOURNAL' | 'FINALS';

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
  const contextQuery = useGradebookContext();
  const context = contextQuery.data;

  const scopes = useMemo(() => context?.scopes ?? [], [context]);
  const periods = useMemo(() => context?.periods ?? [], [context]);
  const months = useMemo(() => monthOptionsOf(periods), [periods]);

  const tab = (params.get('tab') === 'finals' ? 'FINALS' : 'JOURNAL') as JournalTab;
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
      <JournalShell tab={tab} onTab={(next) => patch({ tab: next === 'FINALS' ? 'finals' : null })}>
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

  if (scopes.length === 0) {
    return (
      <JournalShell tab={tab} onTab={(next) => patch({ tab: next === 'FINALS' ? 'finals' : null })}>
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
    <JournalShell tab={tab} onTab={(next) => patch({ tab: next === 'FINALS' ? 'finals' : null })}>
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
        onChangeClass={(next) => patch({ classId: next, subjectId: null, subgroupId: null })}
        onChangeSubgroup={(next) => patch({ subgroupId: next })}
        onChangeSubject={(next) => patch({ subjectId: next })}
        onChangePeriod={(next) => patch({ periodId: next })}
        onChangeMonth={(next) => patch({ month: next })}
        onChangeWindow={(next) => patch({ window: next === 'MONTH' ? 'month' : null })}
      />

      {tab === 'JOURNAL' ? (
        <JournalTab query={journalQuery} journal={journal} finals={finals} />
      ) : (
        <FinalsTab finalsKey={finalsKey} finals={finals} />
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

  if (rows.every((row) => (row.cells ?? []).length === 0)) {
    return (
      <div className="card">
        <EmptyBlock
          icon={<Award className="size-7" />}
          title="Оценок пока нет"
          description="Оценки появятся здесь после того, как их выставят на уроке"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="card overflow-hidden p-0">
        <JournalTable
          journal={data!}
          finals={finalsByStudent(finals.data?.rows ?? [])}
          today={todayIso()}
        />
      </div>
      <Legend />
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
  const filled = rows.filter((row) => row.finalGrade?.value != null).length;
  const allFilled = rows.length > 0 && filled === rows.length;
  const allPublished =
    rows.length > 0 && rows.every((row) => row.finalGrade?.status === 'PUBLISHED');

  async function pick(row: ClassFinalGradeRow, value: number) {
    setError(null);
    setBusyStudentId(row.studentProfileId as number);
    try {
      await setFinal.mutateAsync({
        finalGradeId: row.finalGrade?.id ?? null,
        studentProfileId: row.studentProfileId as number,
        subjectId: finalsKey!.subjectId,
        academicPeriodId: finalsKey!.academicPeriodId,
        value,
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
      if (failure instanceof ApiError && failure.code === FINAL_GRADE_ERRORS.setIncomplete) {
        setMissing(new Set(incompleteStudentIdsFrom(failure.details)));
        setError('Итоги выставлены не всем ученикам — опубликовать четверть нельзя');
        return;
      }
      setError(failure instanceof ApiError ? failure.message : 'Не удалось опубликовать итоги');
    }
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

  return (
    <div className="flex flex-col gap-4">
      <div className="card overflow-hidden p-0">
        <QuarterFinalsTable
          finals={data}
          highlighted={missing}
          busyStudentId={busyStudentId}
          onPick={(row, value) => void pick(row, value)}
        />
      </div>

      {error && (
        <p className="rounded-xl bg-danger-bg px-4 py-3 text-13 font-semibold text-red-600">
          {error}
        </p>
      )}

      {canManage && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5">
          <p className="flex items-center gap-3 text-13 text-slate-600">
            <span
              className={`size-2 shrink-0 rounded-full ${allPublished ? 'bg-green-500' : allFilled ? 'bg-brand-500' : 'bg-slate-300'}`}
            />
            {allPublished
              ? 'Итоги четверти опубликованы — их видят ученик и родитель'
              : allFilled
                ? `Все итоги выставлены (${filled} из ${rows.length}) — можно публиковать`
                : `Выставьте оценку всем ученикам, чтобы опубликовать итоги четверти (${filled} из ${rows.length} оценено)`}
          </p>
          <Button
            onClick={() => setConfirmPublish(true)}
            disabled={!allFilled || allPublished}
            loading={publish.isPending}
          >
            Опубликовать итоги четверти
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmPublish}
        title="Опубликовать итоги четверти?"
        message="После публикации итоговые оценки увидят ученики и родители. Изменить их можно будет до публикации годовой оценки."
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
        </TabsList>
      </Tabs>

      {children}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-6 px-1 text-13 text-slate-500">
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
        <span className="text-slate-300">✕</span>
        Занятие не состоялось
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
