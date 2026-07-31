/**
 * Месячная сетка школьного календаря (Figma 2015:10147).
 *
 * Даты — строки YYYY-MM-DD, как их отдаёт бэкенд (LocalDate). Вся арифметика
 * идёт через UTC, чтобы часовой пояс браузера не сдвигал день: `new Date('2026-10-28')`
 * в отрицательном оффсете даёт 27-е.
 */

import type { CalendarEvent } from '@/lib/scheduleSettingsTypes';

const MONTH_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const MONTH_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

export type YearMonth = {
  year: number;
  /** 1–12, как в ISO-строке, а не как в Date. */
  month: number;
};

export type MonthCell = {
  /** YYYY-MM-DD */
  date: string;
  dayOfMonth: number;
  /** День соседнего месяца — в макете он приглушён (2015:10248). */
  outside: boolean;
  events: CalendarEvent[];
};

function toIso(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function utc(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day);
}

function parseIso(iso: string): number | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return utc(Number(match[1]), Number(match[2]), Number(match[3]));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Понедельник = 0, воскресенье = 6 — сетка начинается с понедельника. */
function mondayIndex(time: number): number {
  return (new Date(time).getUTCDay() + 6) % 7;
}

export function monthTitle({ year, month }: YearMonth): string {
  return `${MONTH_NOMINATIVE[month - 1]} ${year}`;
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const zeroBased = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

export function monthOf(iso: string): YearMonth {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) };
}

/**
 * Границы сетки, а не месяца: события грузим на весь показанный диапазон,
 * иначе хвосты соседних месяцев остались бы пустыми.
 */
export function monthGridRange({ year, month }: YearMonth): { from: string; to: string } {
  const first = utc(year, month, 1);
  const lastDay = new Date(utc(year, month + 1, 0)).getUTCDate();
  const last = utc(year, month, lastDay);
  return {
    from: toIso(first - mondayIndex(first) * DAY_MS),
    to: toIso(last + (6 - mondayIndex(last)) * DAY_MS),
  };
}

/** Недели по 7 ячеек, от понедельника первой недели до воскресенья последней. */
export function buildMonthGrid(target: YearMonth, events: CalendarEvent[]): MonthCell[][] {
  const { from, to } = monthGridRange(target);
  const start = parseIso(from)!;
  const end = parseIso(to)!;
  const byDate = groupEventsByDate(events);

  const weeks: MonthCell[][] = [];
  let week: MonthCell[] = [];
  for (let time = start; time <= end; time += DAY_MS) {
    const date = toIso(time);
    const cellMonth = Number(date.slice(5, 7));
    week.push({
      date,
      dayOfMonth: new Date(time).getUTCDate(),
      outside: cellMonth !== target.month,
      events: byDate.get(date) ?? [],
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  return weeks;
}

/** Событие-период попадает в каждый свой день, а не только в первый. */
function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const from = parseIso(event.dateFrom);
    const to = parseIso(event.dateTo);
    if (from == null || to == null || to < from) continue;
    for (let time = from; time <= to; time += DAY_MS) {
      const key = toIso(time);
      const list = byDate.get(key);
      if (list) list.push(event);
      else byDate.set(key, [event]);
    }
  }
  return byDate;
}

/** «28 окт – 5 ноя 2026», «5 окт 2026» — формат колонки ДАТЫ (2015:9795). */
export function formatEventDates(dateFrom: string, dateTo: string): string {
  const from = parseIso(dateFrom);
  const to = parseIso(dateTo);
  if (from == null || to == null) return `${dateFrom} – ${dateTo}`;

  const fromParts = new Date(from);
  const toParts = new Date(to);
  const fromDay = fromParts.getUTCDate();
  const toDay = toParts.getUTCDate();
  const fromMonth = MONTH_SHORT[fromParts.getUTCMonth()];
  const toMonth = MONTH_SHORT[toParts.getUTCMonth()];
  const fromYear = fromParts.getUTCFullYear();
  const toYear = toParts.getUTCFullYear();

  if (dateFrom === dateTo) return `${fromDay} ${fromMonth} ${fromYear}`;
  if (fromYear !== toYear) {
    return `${fromDay} ${fromMonth} ${fromYear} – ${toDay} ${toMonth} ${toYear}`;
  }
  return `${fromDay} ${fromMonth} – ${toDay} ${toMonth} ${toYear}`;
}
