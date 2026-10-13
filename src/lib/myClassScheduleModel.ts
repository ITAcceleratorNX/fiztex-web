import type { Schema } from '@/lib/apiSchemas';
import { shortName } from '@/lib/attendanceJournalModel';
import { shortDate } from '@/lib/journalModel';
import { hhmm, rowKeyOf, shiftDays, weekRows, type WeekRow } from '@/pages/schedule/myWeek';

type Period = Schema<'MyClassContextPeriodView'>;
type ScheduleView = Schema<'MyClassScheduleView'>;
type Fact = Schema<'MyClassScheduleFactView'>;
type Slot = NonNullable<NonNullable<ScheduleView['plan']>['slots']>[number];

/**
 * Вкладка «Расписание» классного руководителя (Figma 2200:3245).
 *
 * <p>Два источника и они не смешиваются (my-class-contract, `10-schedule-api.md`):
 * <b>факты</b> — уже сформированные уроки с заменами и отменами, и <b>план</b> —
 * опубликованная недельная сетка без дат. Неделю с фактами рисуем по фактам и честно
 * говорим, что покрытие не доказано; неделю без фактов — по плану, с пометкой, что это
 * план (решение пользователя 2026-10-07). Достраивать факты из плана нельзя: план не
 * знает ни замен, ни отмен, ни каникул.
 */

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
const WEEKDAY_NAME = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const MONTH_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** Понедельник недели даты — неделя в адресе хранится им. */
export function mondayOf(date: string): string {
  const day = new Date(`${date}T12:00:00`).getDay();
  return shiftDays(date, day === 0 ? -6 : 1 - day);
}

export interface WeekPart {
  periodId: number;
  from: string;
  to: string;
}

/**
 * Куски недели по учебным периодам: `/schedule` принимает даты только внутри одного
 * периода, и неделя на стыке четвертей запрашивается отдельно для каждой.
 */
export function weekParts(periods: Period[], weekStart: string): WeekPart[] {
  const weekEnd = shiftDays(weekStart, 6);
  return periods.flatMap((period) => {
    if (period.id == null || !period.startDate || !period.endDate) return [];
    const from = period.startDate > weekStart ? period.startDate : weekStart;
    const to = period.endDate < weekEnd ? period.endDate : weekEnd;
    return from <= to ? [{ periodId: period.id, from, to }] : [];
  });
}

function dayMonth(date: string): { day: number; month: number; year: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { day, month: month - 1, year };
}

/** «13 – 17 октября 2026», «29 сентября – 3 октября 2026», через Новый год — с годами. */
export function weekLabel(first: string, last: string): string {
  const a = dayMonth(first);
  const b = dayMonth(last);
  if (a.year !== b.year) {
    return `${a.day} ${MONTH_GENITIVE[a.month]} ${a.year} – ${b.day} ${MONTH_GENITIVE[b.month]} ${b.year}`;
  }
  if (a.month !== b.month) {
    return `${a.day} ${MONTH_GENITIVE[a.month]} – ${b.day} ${MONTH_GENITIVE[b.month]} ${b.year}`;
  }
  return `${a.day} – ${b.day} ${MONTH_GENITIVE[b.month]} ${b.year}`;
}

export interface ScheduleEntry {
  key: string;
  date: string;
  lessonNumber?: number | null;
  startTime?: string;
  endTime?: string;
  subject: string;
  teacher: string;
  /** Полное имя — в подсказку: в клетке учитель сокращён до инициалов. */
  teacherFull: string;
  room: string | null;
  subgroup: string | null;
  cancelled: boolean;
  substituted: boolean;
  /** Ссылка в карточку урока — только если сервер сказал, что она откроется. */
  lessonId: number | null;
}

export interface ScheduleColumn {
  date: string;
  weekday: string;
  label: string;
  isToday: boolean;
}

export interface ScheduleRow extends WeekRow {
  label: string;
}

export type ScheduleWeek =
  | { kind: 'outside' }
  | { kind: 'empty' }
  | { kind: 'facts' | 'plan'; columns: ScheduleColumn[]; rows: ScheduleRow[]; entries: ScheduleEntry[] };

/** «312» → «Каб. 312», «Спортзал» — как есть. */
export function roomLabel(room: string | null | undefined): string | null {
  const trimmed = room?.trim();
  if (!trimmed) return null;
  return /^\d/.test(trimmed) ? `Каб. ${trimmed}` : trimmed;
}

function factEntry(fact: Fact): ScheduleEntry {
  const substituted = fact.substituteTeacherName != null;
  const teacherFull = (substituted ? fact.substituteTeacherName : fact.teacherName) ?? '';
  return {
    key: `fact:${fact.lessonId}`,
    date: fact.date ?? '',
    lessonNumber: fact.lessonNumber,
    startTime: fact.startTime,
    endTime: fact.endTime,
    subject: fact.subjectName ?? '',
    teacher: shortName(teacherFull),
    teacherFull,
    room: roomLabel(fact.room),
    subgroup: fact.subgroupName ?? null,
    cancelled: fact.status === 'CANCELLED',
    substituted,
    lessonId: fact.canOpen && fact.lessonId != null ? fact.lessonId : null,
  };
}

function slotEntry(slot: Slot, weekStart: string): ScheduleEntry | null {
  const offset = WEEKDAYS.indexOf(slot.weekday as (typeof WEEKDAYS)[number]);
  if (offset < 0) return null;
  const teacherFull = slot.teacherName ?? '';
  return {
    key: `slot:${slot.scheduleLessonId}`,
    date: shiftDays(weekStart, offset),
    lessonNumber: slot.lessonNumber,
    startTime: slot.startTime,
    endTime: slot.endTime,
    subject: slot.subjectName ?? '',
    teacher: shortName(teacherFull),
    teacherFull,
    room: roomLabel(slot.room),
    subgroup: slot.subgroupName ?? null,
    cancelled: false,
    substituted: false,
    lessonId: null,
  };
}

/**
 * Колонки — пятидневка плюс суббота и воскресенье, если в них что-то стоит: шестидневка
 * не должна терять свои уроки, а пустая суббота у пятидневки — лишний столбец.
 */
function columnsOf(weekStart: string, entries: ScheduleEntry[], today: string): ScheduleColumn[] {
  const dates = new Set(entries.map((entry) => entry.date));
  return WEEKDAY_NAME.flatMap((weekday, offset) => {
    const date = shiftDays(weekStart, offset);
    if (offset >= 5 && !dates.has(date)) return [];
    return [{ date, weekday, label: shortDate(date), isToday: date === today }];
  });
}

/** Время строки — от самого раннего урока строки до его конца: «08:00–08:45». */
function rowsOf(entries: ScheduleEntry[]): ScheduleRow[] {
  return weekRows(entries).map((row) => {
    const first = entries.find((entry) => rowKeyOf(entry) === row.key && hhmm(entry.startTime) === row.time);
    const end = hhmm(first?.endTime);
    return { ...row, label: row.time ? `${row.time}${end ? `–${end}` : ''}` : '' };
  });
}

export function buildScheduleWeek(views: ScheduleView[], weekStart: string, today: string): ScheduleWeek {
  if (views.length === 0) return { kind: 'outside' };
  const facts = views.flatMap((view) => view.facts ?? []).map(factEntry);
  if (facts.length > 0) {
    return { kind: 'facts', columns: columnsOf(weekStart, facts, today), rows: rowsOf(facts), entries: facts };
  }
  // План живёт в периоде: на днях недели вне его границ он ничего не обещает.
  const planned = views.find((view) => view.planState === 'PUBLISHED' && (view.plan?.slots?.length ?? 0) > 0);
  if (!planned?.plan) return { kind: 'empty' };
  const slots = (planned.plan.slots ?? [])
    .flatMap((slot) => slotEntry(slot, weekStart) ?? [])
    .filter((entry) => (!planned.from || entry.date >= planned.from) && (!planned.to || entry.date <= planned.to));
  if (slots.length === 0) return { kind: 'empty' };
  return { kind: 'plan', columns: columnsOf(weekStart, slots, today), rows: rowsOf(slots), entries: slots };
}
