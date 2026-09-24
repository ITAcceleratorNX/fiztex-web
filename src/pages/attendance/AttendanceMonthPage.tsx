import { useMemo, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarCheck, CalendarX2, ChevronLeft } from 'lucide-react';
import { Field, Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useTeacherJournal, useTeacherJournalOptions } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { TeacherJournalQuery, TeacherJournalScope } from '@/lib/attendanceApi';
import {
  defaultMonth,
  journalRows,
  monthDays,
  parseScopeKey,
  scopeKey,
  scopeLabel,
  yearMonths,
} from '@/lib/attendanceJournalModel';
import { formatWeekdayDayMonth } from '@/lib/format';
import { monthLabel } from '@/lib/monthlyFeedbackModel';
import { ROUTES } from '@/lib/routes';
import { localDate } from '@/pages/schedule/myWeek';
import { AttendanceLegend, AttendanceMonthTable } from './AttendanceMonthTable';

/**
 * Посещаемость за месяц (Figma 2170:3823 — пусто, 2170:2360 — таблица).
 *
 * <p>Выбор класса и месяца живёт в адресе (`?scope=12:34&month=2026-09`): ссылку можно
 * переслать, «Назад» возвращает к тому же классу, а страница кода урока открывает журнал
 * сразу на своём классе.
 *
 * <p>Какие классы и месяцы бывают, решает бэкенд: пары «класс + подгруппа» — по урокам
 * учителя, месяцы — по границам учебного года (`teacher-journal/options`). Пара из адреса,
 * которой у учителя нет, просто не выбирается — вместо чужого журнала экран попросит выбрать
 * класс.
 */
export function AttendanceMonthPage() {
  useDocumentTitle('Посещаемость за месяц');
  const [params, setParams] = useSearchParams();

  const optionsQuery = useTeacherJournalOptions();
  const options = optionsQuery.data;
  const scopes = options?.scopes ?? [];
  const months = useMemo(() => yearMonths(options?.academicYear), [options?.academicYear]);

  const monthParam = params.get('month');
  const month = monthParam && months.includes(monthParam) ? monthParam : defaultMonth(months);
  const scope = pickScope(scopes, params.get('scope'));

  const query: TeacherJournalQuery | null =
    scope?.classId != null && month
      ? { month, classId: scope.classId, subgroupId: scope.subgroupId ?? null }
      : null;
  const journalQuery = useTeacherJournal(query);

  const days = useMemo(() => (month ? monthDays(month) : []), [month]);
  const rows = useMemo(
    () =>
      journalRows(journalQuery.data, {
        subgroupFiltered: scope?.subgroupId != null,
        today: localDate(),
      }),
    [journalQuery.data, scope?.subgroupId],
  );

  function patch(next: Record<string, string | undefined>) {
    setParams(
      (current) => {
        const merged = new URLSearchParams(current);
        for (const [key, value] of Object.entries(next)) {
          if (value) merged.set(key, value);
          else merged.delete(key);
        }
        return merged;
      },
      { replace: true },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to={ROUTES.myAttendance}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-700 hover:text-navy-800"
          >
            <ChevronLeft className="size-4" aria-hidden />К списку уроков
          </Link>
          <span className="text-sm font-medium text-slate-600">{formatWeekdayDayMonth()}</span>
        </div>
        <h1 className="text-lg font-bold text-navy-700">Посещаемость за месяц</h1>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Field label="Класс / подгруппа">
            <Select
              aria-label="Класс / подгруппа"
              value={scope ? scopeKey(scope) : ''}
              placeholder="Выберите класс"
              disabled={scopes.length === 0}
              onChange={(event) => patch({ scope: event.target.value })}
            >
              {scopes.map((option) => (
                <option key={scopeKey(option)} value={scopeKey(option)}>
                  {scopeLabel(option)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="w-56">
          <Field label="Месяц">
            <Select
              aria-label="Месяц"
              value={month ?? ''}
              placeholder="Выберите месяц"
              disabled={months.length === 0}
              onChange={(event) => patch({ month: event.target.value })}
            >
              {months.map((value) => (
                <option key={value} value={value}>
                  {monthLabel(value)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <AttendanceLegend />

      {optionsQuery.isPending ? (
        <Card>
          <LoadingBlock />
        </Card>
      ) : optionsQuery.isError ? (
        <Card>
          <ErrorBlock message="Не удалось загрузить журнал" onRetry={() => void optionsQuery.refetch()} />
        </Card>
      ) : !options?.academicYear ? (
        <Card>
          <EmptyBlock
            icon={<CalendarX2 className="size-6" />}
            title="Учебный год ещё не заведён — журнала пока нет"
          />
        </Card>
      ) : scopes.length === 0 ? (
        <Card>
          <EmptyBlock icon={<CalendarX2 className="size-6" />} title="В этом учебном году у вас нет уроков" />
        </Card>
      ) : !query ? (
        <Card>
          <EmptyBlock
            icon={<CalendarCheck className="size-6" />}
            title="Выберите класс и месяц, чтобы увидеть журнал посещаемости"
          />
        </Card>
      ) : journalQuery.isPending ? (
        <Card>
          <LoadingBlock />
        </Card>
      ) : journalQuery.isError ? (
        <Card>
          <ErrorBlock message="Не удалось загрузить журнал" onRetry={() => void journalQuery.refetch()} />
        </Card>
      ) : (journalQuery.data?.lessons ?? []).length === 0 ? (
        <Card>
          <EmptyBlock
            icon={<CalendarX2 className="size-6" />}
            title="В этом месяце у вас не было уроков в этом классе"
          />
        </Card>
      ) : (
        <AttendanceMonthTable days={days} rows={rows} />
      )}
    </div>
  );
}

/** Figma `empty-state-card`: та же рамка, что у таблицы, чтобы экран не прыгал при выборе. */
function Card({ children }: { children: ReactNode }) {
  return <section className="min-h-96 rounded-2xl border border-slate-200 bg-white">{children}</section>;
}

/**
 * Пара из адреса — только если она есть у учителя. Единственная пара выбирается сама:
 * приглашение «выберите класс» при одном варианте было бы лишним шагом.
 */
function pickScope(scopes: TeacherJournalScope[], key: string | null): TeacherJournalScope | undefined {
  const requested = parseScopeKey(key);
  const match = requested
    ? scopes.find(
        (scope) => scope.classId === requested.classId && (scope.subgroupId ?? null) === requested.subgroupId,
      )
    : undefined;
  return match ?? (scopes.length === 1 ? scopes[0] : undefined);
}
