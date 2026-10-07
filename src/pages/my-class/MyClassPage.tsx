import { CalendarCheck2, ChartNoAxesColumnIncreasing, School, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { StatCard } from '@/components/ui/StatCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useMyClassContext, useMyClassRoster, useMyClassSummary } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import { MyClassGradesTab } from './MyClassGradesTab';
import { MyClassStudentsTab } from './MyClassStudentsTab';

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

const TABS = ['students', 'grades'] as const;
type Tab = (typeof TABS)[number];

function tabOf(value: string | null): Tab {
  return TABS.find((tab) => tab === value) ?? 'students';
}

const oneDecimal = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const upToOneDecimal = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

/**
 * «Мой класс» классного руководителя: шапка класса, карточки сводки и вкладки.
 *
 * <p>Класс, период и вкладка живут в адресе, поэтому переход между вкладками сохраняет
 * выбор, а ссылка открывает тот же вид. Значения из адреса применяются, только если они
 * есть в `/context`; иначе берутся серверные значения по умолчанию.
 *
 * <p>Отзыв назначения ловится на любой вкладке: `403` любого запроса класса прячет его
 * данные, перечитывает контекст и, если класса больше нет, удаляет всё, что о нём
 * закэшировано.
 */
export function MyClassPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const refreshedRevokedClass = useRef<number | null>(null);
  const [forbiddenClassId, setForbiddenClassId] = useState<number | null>(null);
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
  const tab = tabOf(searchParams.get('tab'));

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
    if (next.has('tab') && next.get('tab') !== tab) next.delete('tab');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [classId, context.data, periodId, requestedClassId, requestedPeriodId, searchParams, setSearchParams, tab]);

  const roster = useMyClassRoster(classId);
  const summary = useMyClassSummary(classId, periodId);
  const accessRevoked = (classId != null && forbiddenClassId === classId) || [roster.error, summary.error].some(
    (error) => error instanceof ApiError && error.status === 403,
  );
  const totalStudents = roster.data?.pages[0]?.totalItems
    ?? roster.data?.pages.flatMap((page) => page.items ?? []).length ?? 0;

  useEffect(() => {
    if (!accessRevoked) {
      refreshedRevokedClass.current = null;
      return;
    }
    if (classId == null || refreshedRevokedClass.current === classId) return;
    refreshedRevokedClass.current = classId;
    void context.refetch().then((result) => {
      if (!result.data?.classes?.some((item) => item.id === classId)) {
        queryClient.removeQueries({ queryKey: ['my-class', 'classes', classId] });
      }
    });
  }, [accessRevoked, classId, context, queryClient]);

  const reportForbidden = useCallback(() => setForbiddenClassId(classId), [classId]);

  function updateParam(name: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value == null) next.delete(name);
    else next.set(name, value);
    setSearchParams(next);
  }

  async function retryAccess() {
    const result = await context.refetch();
    setForbiddenClassId(null);
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
      ) : !selectedClass || classId == null ? (
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
                <Select aria-label="Выберите класс" value={String(classId)} onChange={(event) => updateParam('classId', event.target.value)}>
                  {classes.filter((item) => item.id != null).map((item) => (
                    <option key={item.id} value={item.id}>{classLabel(item.name ?? '')}</option>
                  ))}
                </Select>
              )}
              {/* На «Оценках» период выбирается в строке фильтров, как в макете. */}
              {tab === 'students' && (periods.length > 1 || (periods.length > 0 && periodId == null)) && (
                <Select aria-label="Выберите учебный период" value={periodId == null ? '' : String(periodId)}
                  placeholder="Выберите период" onChange={(event) => updateParam('periodId', event.target.value)}>
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

          <Tabs value={tab} variant="pills" onValueChange={(value) => updateParam('tab', value === 'students' ? null : value)}>
            <TabsList>
              <TabsTrigger value="students">Ученики</TabsTrigger>
              <TabsTrigger value="grades">Оценки</TabsTrigger>
              <TabsTrigger value="attendance" disabled>Посещаемость</TabsTrigger>
              <TabsTrigger value="schedule" disabled>Расписание</TabsTrigger>
            </TabsList>
            <TabsContent value="students" className="mt-4">
              <MyClassStudentsTab classId={classId} />
            </TabsContent>
            <TabsContent value="grades" className="mt-4">
              <MyClassGradesTab
                classId={classId}
                periods={periods}
                periodId={periodId}
                onSelectPeriod={(value) => updateParam('periodId', value)}
                onForbidden={reportForbidden}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
