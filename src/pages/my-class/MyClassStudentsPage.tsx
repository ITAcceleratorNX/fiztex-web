import { CalendarCheck2, ChartNoAxesColumnIncreasing, School, UsersRound } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { StatCard } from '@/components/ui/StatCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { keys, useMyClassContext, useMyClassRoster, useMyClassSummary } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

function academicYearLabel(context: Schema<'MyClassContextView'>): string {
  const start = context.yearStartDate?.slice(0, 4);
  const end = context.yearEndDate?.slice(0, 4);
  return start && end ? `${start}/${end} учебный год` : 'Учебный год';
}

function classLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'Класс';
  return trimmed.toLocaleLowerCase('ru-RU').endsWith('класс') ? trimmed : `${trimmed} класс`;
}

function noClassTitle(state: Schema<'MyClassContextView'>['state']): string {
  switch (state) {
    case 'NO_ACTIVE_YEAR': return 'Нет активного учебного года';
    case 'YEAR_NOT_STARTED': return 'Учебный год ещё не начался';
    case 'YEAR_ENDED': return 'Учебный год завершён';
    default: return 'У вас пока нет своего класса';
  }
}

function studentCountLabel(count: number): string {
  const plural = new Intl.PluralRules('ru-RU').select(count);
  return `${count} ${plural === 'one' ? 'ученик' : plural === 'few' ? 'ученика' : 'учеников'}`;
}

const oneDecimal = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const upToOneDecimal = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

function StudentCell({ student }: { student: Schema<'MyClassStudentView'> }) {
  const name = student.displayName?.trim()
    || [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
  return (
    <li className="flex min-h-11 min-w-0 items-center gap-3 border-b border-line px-6 py-1.5">
      <Avatar name={name} size="sm" variant="navy" />
      <span className="truncate text-sm font-bold text-slate-900" title={name}>{name}</span>
    </li>
  );
}

export function MyClassStudentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const refreshedRevokedClass = useRef<number | null>(null);
  const context = useMyClassContext();
  const classes = context.data?.classes ?? [];
  const requestedClassId = Number(searchParams.get('classId'));
  const selectedClass = classes.find((item) => item.id === requestedClassId)
    ?? classes.find((item) => item.id === context.data?.defaultClassId)
    ?? classes[0];
  const classId = selectedClass?.id ?? null;
  const periods = context.data?.periods ?? [];
  const requestedPeriodId = Number(searchParams.get('periodId'));
  const selectedPeriod = periods.find((item) => item.id === requestedPeriodId)
    ?? periods.find((item) => item.id === context.data?.defaultPeriodId);
  const periodId = selectedPeriod?.id ?? null;

  useEffect(() => {
    if (!context.data) return;
    const next = new URLSearchParams(searchParams);
    if (next.has('classId')) {
      if (classId == null) next.delete('classId');
      else if (requestedClassId !== classId) next.set('classId', String(classId));
    }
    if (next.has('periodId')) {
      if (periodId == null) next.delete('periodId');
      else if (requestedPeriodId !== periodId) next.set('periodId', String(periodId));
    }
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [classId, context.data, periodId, requestedClassId, requestedPeriodId, searchParams, setSearchParams]);

  const roster = useMyClassRoster(classId);
  const summary = useMyClassSummary(classId, periodId);
  const accessRevoked = [roster.error, summary.error].some(
    (error) => error instanceof ApiError && error.status === 403,
  );
  const students = roster.data?.pages.flatMap((page) => page.items ?? []) ?? [];
  const totalStudents = roster.data?.pages[0]?.totalItems ?? students.length;

  useEffect(() => {
    if (!accessRevoked) {
      refreshedRevokedClass.current = null;
      return;
    }
    if (classId == null || refreshedRevokedClass.current === classId) return;
    refreshedRevokedClass.current = classId;
    void context.refetch().then((result) => {
      if (!result.data?.classes?.some((item) => item.id === classId)) {
        queryClient.removeQueries({ queryKey: keys.myClassRoster(classId) });
        queryClient.removeQueries({ queryKey: ['my-class', 'classes', classId, 'summary'] });
      }
    });
  }, [accessRevoked, classId, context, queryClient]);

  function selectClass(nextId: string) {
    const next = new URLSearchParams(searchParams);
    next.set('classId', nextId);
    setSearchParams(next);
  }

  function selectPeriod(nextId: string) {
    const next = new URLSearchParams(searchParams);
    next.set('periodId', nextId);
    setSearchParams(next);
  }

  async function retryAccess() {
    const result = await context.refetch();
    if (result.data?.classes?.some((item) => item.id === classId)) {
      await Promise.all([roster.refetch(), ...(periodId == null ? [] : [summary.refetch()])]);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Мой класс</h1>

      {context.isPending ? <LoadingBlock label="Загрузка классов…" /> : context.isError ? (
        <ErrorBlock message="Не удалось загрузить данные класса." onRetry={() => void context.refetch()} />
      ) : accessRevoked ? (
        <ErrorBlock message="Доступ к классу изменился. Обновите список классов." onRetry={retryAccess} />
      ) : !selectedClass ? (
        <EmptyBlock
          icon={<School className="h-7 w-7" />}
          title={noClassTitle(context.data.state)}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{classLabel(selectedClass.name ?? '')}</h2>
              <p className="mt-1 text-sm text-slate-500">{academicYearLabel(context.data)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {classes.length > 1 && (
                <Select aria-label="Выберите класс" value={String(classId)} onChange={(event) => selectClass(event.target.value)}>
                  {classes.filter((item) => item.id != null).map((item) => (
                    <option key={item.id} value={item.id}>{classLabel(item.name ?? '')}</option>
                  ))}
                </Select>
              )}
              {(periods.length > 1 || (periods.length > 0 && periodId == null)) && (
                <Select aria-label="Выберите учебный период" value={periodId == null ? '' : String(periodId)}
                  placeholder="Выберите период" onChange={(event) => selectPeriod(event.target.value)}>
                  {periods.filter((item) => item.id != null).map((item) => (
                    <option key={item.id} value={item.id}>{item.name ?? `Период ${item.id}`}</option>
                  ))}
                </Select>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard variant="compact" icon={UsersRound} label="Учеников" value={roster.isPending ? '…' : totalStudents} />
            <StatCard variant="compact" icon={ChartNoAxesColumnIncreasing} label="Средний балл" value={
              summary.isPending && periodId != null ? '…'
                : summary.data?.averageGrade == null ? '—' : oneDecimal.format(summary.data.averageGrade)
            } />
            <StatCard variant="compact" icon={CalendarCheck2} tone="success" label="Посещаемость за месяц" value={
              summary.isPending && periodId != null ? '…'
                : summary.data?.monthlyAttendancePercent == null
                ? '—' : `${upToOneDecimal.format(summary.data.monthlyAttendancePercent)}%`
            } />
          </div>
          {periodId == null ? (
            <p className="text-sm text-muted">{periods.length === 0
              ? 'Учебные периоды пока не настроены. Показатели класса недоступны.'
              : 'Выберите учебный период, чтобы увидеть показатели класса.'}</p>
          ) : summary.isError ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
              <span>Не удалось загрузить показатели класса.</span>
              <Button variant="secondary" size="sm" onClick={() => void summary.refetch()}>Повторить</Button>
            </div>
          ) : summary.data && (summary.data.averageGrade == null || summary.data.monthlyAttendancePercent == null) ? (
            <p className="text-sm text-muted">
              {summary.data.averageGrade == null && summary.data.monthlyAttendancePercent == null
                ? 'За период пока нет шкальных оценок, а за месяц — опубликованных отметок посещаемости.'
                : summary.data.averageGrade == null
                  ? 'За период пока нет шкальных оценок.'
                  : 'За месяц пока нет опубликованных отметок посещаемости.'}
            </p>
          ) : null}

          <Tabs value="students" variant="pills">
            <TabsList>
              <TabsTrigger value="students">Ученики</TabsTrigger>
              <TabsTrigger value="grades" disabled>Оценки</TabsTrigger>
              <TabsTrigger value="attendance" disabled>Посещаемость</TabsTrigger>
              <TabsTrigger value="schedule" disabled>Расписание</TabsTrigger>
            </TabsList>
            <TabsContent value="students" className="mt-4">
              <section aria-label="Ученики класса" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
                <div className="h-10 border-b border-line bg-canvas" aria-hidden="true" />
                {roster.isPending ? <LoadingBlock label="Загрузка учеников…" /> : roster.isError ? (
                  <ErrorBlock message="Не удалось загрузить данные класса." onRetry={() => void roster.refetch()} />
                ) : students.length === 0 ? (
                  <EmptyBlock title="В классе пока нет учеников" />
                ) : (
                  <>
                    <ul className="grid grid-cols-1 sm:grid-cols-2">
                      {students.map((student) => <StudentCell key={student.studentProfileId} student={student} />)}
                    </ul>
                    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                      <p className="text-sm text-muted">Всего: {studentCountLabel(totalStudents)}</p>
                      {roster.hasNextPage && (
                        <Button variant="secondary" size="sm" loading={roster.isFetchingNextPage} onClick={() => void roster.fetchNextPage()}>
                          Показать ещё
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </section>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
