import { useEffect, useMemo, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarRange, Info } from 'lucide-react';
import { NoticeBar } from '@/components/ui/NoticeBar';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { WeekStepper } from '@/components/ui/WeekStepper';
import { useMyClassWeekSchedule } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import { cx } from '@/lib/format';
import {
  buildScheduleWeek,
  mondayOf,
  weekLabel,
  weekParts,
  type ScheduleEntry,
  type ScheduleWeek,
} from '@/lib/myClassScheduleModel';
import { lessonsAt, localDate, shiftDays } from '@/pages/schedule/myWeek';

type Period = Schema<'MyClassContextPeriodView'>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/**
 * Вкладка «Расписание» (Figma 2200:3245): неделя класса по урокам, уже сформированным в
 * системе, а на неделе без них — опубликованная сетка с пометкой «план».
 *
 * <p>Неделя живёт в адресе (`week` — понедельник) и с периодом страницы не связана:
 * расписание листают по неделям, а неделя на стыке четвертей собирается из двух
 * запросов. Карточка урока открывается только там, где её откроет сервер (`canOpen`):
 * классное руководство доступа к чужим урокам не даёт.
 */
export function MyClassScheduleTab({
  classId,
  periods,
  schoolDate,
  onForbidden,
}: {
  classId: number;
  periods: Period[];
  schoolDate: string | undefined;
  onForbidden: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = schoolDate ?? localDate();
  const requestedWeek = searchParams.get('week');
  const weekStart = mondayOf(requestedWeek && ISO_DATE.test(requestedWeek) ? requestedWeek : today);
  const parts = useMemo(() => weekParts(periods, weekStart), [periods, weekStart]);
  const query = useMyClassWeekSchedule(classId, weekStart, parts);
  const week: ScheduleWeek | null = query.data ? buildScheduleWeek(query.data, weekStart, today) : null;
  const yearStart = periods.reduce<string | null>((min, period) =>
    period.startDate && (!min || period.startDate < min) ? period.startDate : min, null);
  const yearEnd = periods.reduce<string | null>((max, period) =>
    period.endDate && (!max || period.endDate > max) ? period.endDate : max, null);
  const lastDay = week && week.kind !== 'outside' && week.kind !== 'empty'
    ? week.columns[week.columns.length - 1]?.date ?? shiftDays(weekStart, 4)
    : shiftDays(weekStart, 4);

  useEffect(() => {
    if (isForbidden(query.error)) onForbidden();
  }, [onForbidden, query.error]);

  // Неделя в адресе — всегда понедельник: другая дата или мусор заменяются.
  useEffect(() => {
    if (requestedWeek == null || requestedWeek === weekStart) return;
    const next = new URLSearchParams(searchParams);
    next.set('week', weekStart);
    setSearchParams(next, { replace: true });
  }, [requestedWeek, searchParams, setSearchParams, weekStart]);

  function goTo(nextWeek: string) {
    const next = new URLSearchParams(searchParams);
    next.set('week', nextWeek);
    setSearchParams(next);
  }

  return (
    <div className="space-y-4">
      <WeekStepper
        value={weekLabel(weekStart, lastDay)}
        onPrevious={() => goTo(shiftDays(weekStart, -7))}
        onNext={() => goTo(shiftDays(weekStart, 7))}
        previousDisabled={yearStart != null && weekStart <= yearStart}
        nextDisabled={yearEnd != null && shiftDays(weekStart, 6) >= yearEnd}
      />

      {query.isPending ? (
        <Card><LoadingBlock label="Загрузка расписания…" /></Card>
      ) : query.isError ? (
        <Card><ErrorBlock message="Не удалось загрузить расписание." onRetry={() => void query.refetch()} /></Card>
      ) : week == null || week.kind === 'outside' ? (
        <Card><EmptyBlock icon={<CalendarRange className="h-7 w-7" />} title="Эта неделя вне учебных периодов" /></Card>
      ) : week.kind === 'empty' ? (
        <Card><EmptyBlock icon={<CalendarRange className="h-7 w-7" />} title="На эту неделю уроков в системе нет" /></Card>
      ) : (
        <>
          {week.kind === 'plan' ? (
            <NoticeBar tone="warning" icon={<Info className="mt-0.5 size-4" aria-hidden />}>
              Уроки на эту неделю ещё не сформированы — показана плановая сетка расписания.
            </NoticeBar>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Info className="size-4 shrink-0" aria-hidden />
              Показаны уроки, уже сформированные в системе. Расписание может быть неполным.
            </p>
          )}
          <Card><WeekGrid week={week} /></Card>
        </>
      )}
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Расписание класса" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      {children}
    </section>
  );
}

const HEAD = 'border-b border-line bg-canvas px-3 py-2.5 text-11 font-semibold text-slate-500';

function WeekGrid({ week }: { week: Extract<ScheduleWeek, { kind: 'facts' | 'plan' }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th scope="col" className={cx(HEAD, 'w-28 border-r text-center uppercase tracking-filter')}>Время</th>
            {week.columns.map((column) => (
              <th
                key={column.date}
                scope="col"
                className={cx(HEAD, 'border-r text-center last:border-r-0', column.isToday && 'bg-info-bg text-navy-700')}
              >
                {column.weekday}
                {week.kind === 'facts' && <span className="ml-1.5 font-normal text-slate-400">{column.label}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {week.rows.map((row) => (
            <tr key={row.key} className="border-b border-line last:border-b-0">
              <th scope="row" className="border-r border-line px-3 py-3 text-center align-middle">
                {row.number != null && <span className="block text-13 font-bold text-ink">{row.number}</span>}
                <span className="block text-10 font-normal text-slate-500">{row.label}</span>
              </th>
              {week.columns.map((column) => {
                const entries = lessonsAt(week.entries, row.key, column.date);
                return (
                  <td key={column.date} className="border-r border-line px-3 py-2.5 align-middle last:border-r-0">
                    <div className="space-y-2">
                      {entries.map((entry) => <EntryView key={entry.key} entry={entry} />)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntryView({ entry }: { entry: ScheduleEntry }) {
  const title = [entry.subgroup, entry.subject, entry.substituted ? `замена: ${entry.teacherFull}` : entry.teacherFull,
    entry.room, entry.cancelled ? 'урок отменён' : null].filter(Boolean).join(' · ');
  const body = (
    <>
      {entry.subgroup && <span className="block truncate text-10 font-semibold text-navy-700">{entry.subgroup}</span>}
      <span className={cx('block truncate text-13 font-bold', entry.cancelled ? 'text-slate-400 line-through' : 'text-ink')}>
        {entry.subject}
      </span>
      <span className={cx('block truncate text-11', entry.substituted ? 'text-orange-600' : 'text-slate-500')}>
        {entry.substituted ? `Замена: ${entry.teacher}` : entry.teacher}
      </span>
      {entry.cancelled
        ? <span className="block text-10 font-semibold text-slate-400">Отменён</span>
        : entry.room && <span className="block truncate text-10 text-slate-500">{entry.room}</span>}
    </>
  );
  return entry.lessonId != null ? (
    <Link
      to={`/lesson-schedule/lessons/${entry.lessonId}`}
      title={`${title} — открыть урок`}
      className="-m-1.5 block rounded-lg p-1.5 transition hover:bg-navy-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400"
    >
      {body}
    </Link>
  ) : (
    <div title={title}>{body}</div>
  );
}
