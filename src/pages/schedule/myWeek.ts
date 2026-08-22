import type { RoleSchedule, RoleScheduleLesson } from '@/lib/lessonsApi';

/**
 * Модель недели «моего расписания»: ответ `/api/schedule/me/week` → колонки, строки, ячейки.
 *
 * Чистые функции без React — раскладка урока по клеткам решается здесь и только здесь,
 * а страница рисует посчитанное. То же разделение сделано в мобильном приложении
 * (`features/schedule/weekGrid.js`): правило одно, и разъезжаться этим двум сеткам нельзя.
 */

const WEEKDAY_ORDER = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
] as const;

export type Weekday = (typeof WEEKDAY_ORDER)[number];

const WEEKDAY_SHORT: Record<Weekday, string> = {
  MONDAY: 'Пн', TUESDAY: 'Вт', WEDNESDAY: 'Ср', THURSDAY: 'Чт',
  FRIDAY: 'Пт', SATURDAY: 'Сб', SUNDAY: 'Вс',
};

export interface WeekColumn {
  date: string;
  label: string;
  dayNumber: number;
  isToday: boolean;
}

export interface WeekRow {
  key: string;
  number: number | null;
  time: string | null;
}

/** Дата в местной зоне: сравнивать «сегодня» по UTC нельзя — на востоке это уже завтра. */
export function localDate(date = new Date()): string {
  return date.toLocaleDateString('sv-SE');
}

export function shiftDays(date: string, days: number): string {
  const shifted = new Date(`${date}T12:00:00`);
  shifted.setDate(shifted.getDate() + days);
  return localDate(shifted);
}

/**
 * Колонки — учебные дни школы, а не фиксированная пятидневка: у шестидневки обязана быть
 * суббота, иначе её уроки просто исчезли бы из сетки.
 */
export function weekColumns(
  weekStart: string | undefined,
  workingDays: readonly string[] | undefined,
  today = localDate(),
): WeekColumn[] {
  if (!weekStart) return [];
  const days = (workingDays?.length ? workingDays : WEEKDAY_ORDER.slice(0, 5)) as Weekday[];
  return days
    .map((day) => WEEKDAY_ORDER.indexOf(day))
    .filter((offset) => offset >= 0)
    .sort((a, b) => a - b)
    .map((offset) => {
      const date = shiftDays(weekStart, offset);
      return {
        date,
        label: WEEKDAY_SHORT[WEEKDAY_ORDER[offset]],
        dayNumber: Number(date.slice(8, 10)),
        isToday: date === today,
      };
    });
}

/** Ключ строки: номер урока, а у заведённого вручную урока без номера — время начала. */
export function rowKeyOf(lesson: RoleScheduleLesson): string {
  return lesson.lessonNumber != null ? `n${lesson.lessonNumber}` : `t${hhmm(lesson.startTime) || '?'}`;
}

export function hhmm(time: string | undefined): string {
  return time ? time.slice(0, 5) : '';
}

/**
 * Строки — номера уроков: второй урок вторника и пятницы стоят в одной строке, даже если
 * в понедельник второго урока нет вовсе.
 *
 * Время строки — самое раннее среди её уроков: у классов учителя бывают разные звонки, и
 * показать одно из них можно только как ориентир. Точное время урока остаётся в ячейке.
 */
export function weekRows(lessons: readonly RoleScheduleLesson[]): WeekRow[] {
  const byKey = new Map<string, WeekRow>();
  for (const lesson of lessons) {
    const key = rowKeyOf(lesson);
    const time = hhmm(lesson.startTime) || null;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { key, number: lesson.lessonNumber ?? null, time });
    } else if (time && (!existing.time || time < existing.time)) {
      existing.time = time;
    }
  }
  return [...byKey.values()].sort(compareRows);
}

function compareRows(a: WeekRow, b: WeekRow): number {
  if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
  if (a.time && !b.time) return -1;
  if (!a.time && b.time) return 1;
  if (a.number == null) return 1;
  if (b.number == null) return -1;
  return a.number - b.number;
}

export function lessonsAt(
  lessons: readonly RoleScheduleLesson[],
  rowKey: string,
  date: string,
): RoleScheduleLesson[] {
  return lessons.filter((lesson) => lesson.date === date && rowKeyOf(lesson) === rowKey);
}

/**
 * Что показывать вместо сетки. Пустая таблица честна только там, где расписание есть, а
 * уроков в нём нет; в остальных случаях она соврала бы — «уроков не нашлось» вместо
 * «расписание не опубликовано».
 */
export type WeekState = { kind: 'grid' } | { kind: 'empty'; message: string };

const STATUS_MESSAGES: Record<string, string> = {
  schedule_not_published: 'Расписание на эту неделю ещё не опубликовано',
  calendar_no_lessons: 'Учебных дней на этой неделе нет — каникулы или выходные',
  non_working_day: 'На этой неделе нет учебных дней',
  no_active_period: 'Нет активного учебного периода',
  no_active_class: 'Нет активного класса',
};

export function weekState(view: RoleSchedule | undefined): WeekState {
  const status = view?.status;
  if (!status || status === 'ok' || status === 'no_lessons' || status === 'no_assigned_lessons') {
    return { kind: 'grid' };
  }
  return { kind: 'empty', message: view?.message || STATUS_MESSAGES[status] || 'Расписание недоступно' };
}
