import type {
  AttendanceMarking,
  TeacherJournal,
  TeacherJournalLesson,
  TeacherJournalScope,
  TeacherJournalStudent,
  TeacherJournalYear,
} from '@/lib/attendanceApi';
import { monthKey } from '@/lib/monthlyFeedbackModel';

/**
 * Журнал посещаемости учителя за месяц — вся логика таблицы без вёрстки
 * (ATTENDANCE-TEACHER-001).
 *
 * Бэкенд отдаёт **уроки**, а макет рисует **дни**: колонка — число месяца, клетка —
 * отметки ученика за этот день. Здесь и происходит переход «уроки → дни», поэтому
 * страница только рисует готовые клетки.
 */

/** Что стоит в клетке за один урок. Цвета — `DAY_MARK_TONE`, подписи — `DAY_MARK_LABEL`. */
export type DayMark = 'present' | 'late' | 'absent' | 'excused' | 'unpublished' | 'cancelled';

export const DAY_MARK_LABEL: Record<DayMark, string> = {
  present: 'Присутствовал',
  late: 'Опоздал',
  absent: 'Пропустил',
  excused: 'Освобождён',
  unpublished: 'Не опубликовано',
  cancelled: 'Урок отменён',
};

/**
 * Порядок легенды — как в макете (Figma `legend-row`). «Нет урока / отменён» — одна
 * позиция: день без урока и отменённый урок для учителя одинаково «отмечать нечего».
 */
export const LEGEND: Array<{ mark: DayMark; label: string }> = [
  { mark: 'present', label: 'Без замечаний' },
  { mark: 'absent', label: 'Пропуски' },
  { mark: 'late', label: 'Опоздания' },
  { mark: 'excused', label: 'Освобождение' },
  { mark: 'unpublished', label: 'Не опубликовано' },
  { mark: 'cancelled', label: 'Нет урока / отменён' },
];

/**
 * Отметка → цвет клетки. Схлопывание то же, что у чипа в мобилке (`attendanceMap.js`):
 * опоздание — это посещение, освобождение — не пропуск (`attendance-read-contract.md` §8).
 * `null` — отметки нет.
 */
export function dayMarkOf(marking: AttendanceMarking | null | undefined): DayMark | null {
  if (marking?.status === 'PRESENT') return marking.mark === 'LATE' ? 'late' : 'present';
  if (marking?.status === 'ABSENT') return marking.mark === 'EXCUSED' ? 'excused' : 'absent';
  return null;
}

// ─── Месяц ──────────────────────────────────────────────────────────────────

const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export interface MonthDay {
  /** `2026-09-03` — ключ клетки, совпадает с `lessonDate` урока. */
  date: string;
  /** `03` — как в шапке макета. */
  label: string;
  weekday: string;
  weekend: boolean;
}

/** Все дни месяца, включая выходные: в макете колонки идут подряд, выходные — серые. */
export function monthDays(month: string): MonthDay[] {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return [];
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const day = i + 1;
    const weekday = new Date(year, monthIndex, day).getDay();
    const label = String(day).padStart(2, '0');
    return {
      date: `${match[1]}-${match[2]}-${label}`,
      label,
      weekday: WEEKDAYS_SHORT[weekday],
      weekend: weekday === 0 || weekday === 6,
    };
  });
}

/**
 * Месяцы учебного года по порядку — список селектора. Строится из границ года, которые
 * отдаёт бэкенд: календарь школы клиенту неизвестен, а выдумывать «сентябрь–май» нельзя.
 */
export function yearMonths(year: TeacherJournalYear | null | undefined): string[] {
  if (!year?.startDate || !year.endDate) return [];
  const months: string[] = [];
  const [startYear, startMonth] = year.startDate.split('-').map(Number);
  const end = year.endDate.slice(0, 7);
  for (let y = startYear, m = startMonth; months.length < 24; m += 1) {
    if (m > 12) {
      m = 1;
      y += 1;
    }
    const key = `${y}-${String(m).padStart(2, '0')}`;
    months.push(key);
    if (key >= end) break;
  }
  return months;
}

/**
 * Какой месяц открыть, если в адресе его нет: текущий, если он в учебном году; иначе
 * ближайший прошедший (летом — май); если год ещё не начался — первый.
 */
export function defaultMonth(months: string[], today: string = monthKey()): string | undefined {
  if (months.length === 0) return undefined;
  if (months.includes(today)) return today;
  const past = months.filter((month) => month < today);
  return past.length > 0 ? past[past.length - 1] : months[0];
}

// ─── Класс и подгруппа ──────────────────────────────────────────────────────

export interface ScopeRef {
  classId: number;
  subgroupId: number | null;
}

/** Пара «класс + подгруппа» в адресе: `12` — весь класс, `12:34` — подгруппа. */
export function scopeKey(scope: { classId?: number; subgroupId?: number | null }): string {
  return scope.subgroupId != null ? `${scope.classId}:${scope.subgroupId}` : String(scope.classId);
}

export function parseScopeKey(key: string | null | undefined): ScopeRef | null {
  const match = /^(\d+)(?::(\d+))?$/.exec(key ?? '');
  if (!match) return null;
  return { classId: Number(match[1]), subgroupId: match[2] ? Number(match[2]) : null };
}

/** «5А — Подгруппа 1» в вебе (Figma `selectors-row`), «5А · Подгруппа 1» в мобилке. */
export function scopeLabel(scope: TeacherJournalScope, separator = ' — '): string {
  return scope.subgroupName
    ? `${scope.className}${separator}${scope.subgroupName}`
    : (scope.className ?? '');
}

// ─── Таблица ────────────────────────────────────────────────────────────────

export interface JournalCell {
  marks: DayMark[];
  /** Подсказка под курсором: какие уроки в этот день и что по каждому. */
  title: string;
}

export interface JournalRow {
  student: TeacherJournalStudent;
  shortName: string;
  cells: Map<string, JournalCell>;
}

/** «Александров Дмитрий Сергеевич» → «Александров Д.С.» — колонка ФИО в макете. */
export function shortName(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts[0]} ${parts
    .slice(1)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join('')}`;
}

/** «Амангельдиева Айгерим Маратқызы» → «Амангельдиева Айгерим М.» — имя целиком, отчество буквой. */
function nameWithFirstName(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  return `${parts[0]} ${parts[1]} ${parts
    .slice(2)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join('')}`;
}

/**
 * Короткие имена всего списка сразу. Инициалы совпадают чаще, чем кажется: в демо-школе
 * это близнецы «Амангельдиева Айгерим» и «Амангельдиева Айгуль» — обе «Амангельдиева А.М.»,
 * и две одинаковые строки подряд нельзя различить. У совпавших имя пишется целиком.
 */
export function shortNames(fullNames: Array<string | null | undefined>): string[] {
  const short = fullNames.map(shortName);
  const counts = new Map<string, number>();
  short.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));
  return short.map((name, index) => ((counts.get(name) ?? 0) > 1 ? nameWithFirstName(fullNames[index]) : name));
}

/**
 * Урок на дату ещё не наступил — отмечать нечего, и серая точка «не опубликовано» на нём
 * читалась бы как долг учителя. Это оформление, а не правило доступа: права и состояние
 * листа всё так же приходят с бэкенда.
 */
function isFuture(lesson: TeacherJournalLesson, today: string): boolean {
  return (lesson.lessonDate ?? '') > today;
}

/**
 * Отметка ученика на одном уроке, либо `null`, если урок к нему не относится.
 *
 * Состав урока знают его строки листа — только если лист есть. У незаполненного урока
 * строк нет, и чей он, видно по адресату: урок всего класса — всех, урок подгруппы —
 * её учеников. Без фильтра по подгруппе принадлежность ученика к чужой подгруппе не
 * определить, и такой урок просто не показывается в его строке.
 */
function markFor(
  lesson: TeacherJournalLesson,
  studentId: number,
  subgroupFiltered: boolean,
  today: string,
): DayMark | null {
  if (lesson.status === 'CANCELLED') {
    return lesson.subgroupId == null || subgroupFiltered ? 'cancelled' : null;
  }
  if (isFuture(lesson, today)) return null;

  const entries = lesson.entries ?? [];
  const entry = entries.find((row) => row.studentProfileId === studentId);
  if (entry) return dayMarkOf(entry.attendance) ?? 'unpublished';
  if (entries.length > 0) return null;
  return lesson.subgroupId == null || subgroupFiltered ? 'unpublished' : null;
}

function lessonTitle(lesson: TeacherJournalLesson, mark: DayMark): string {
  const time = (lesson.startTime ?? '').slice(0, 5);
  return `${time} ${lesson.subjectName ?? ''} — ${DAY_MARK_LABEL[mark]}`.trim();
}

/**
 * Строки таблицы: ученик и его клетки по дням. Порядок учеников — как у бэкенда
 * (по фамилии), уроки внутри дня — по времени: две точки в клетке читаются слева
 * направо, как идут уроки.
 */
export function journalRows(
  journal: TeacherJournal | undefined,
  { subgroupFiltered, today }: { subgroupFiltered: boolean; today: string },
): JournalRow[] {
  const lessons = [...(journal?.lessons ?? [])].sort((a, b) =>
    `${a.lessonDate} ${a.startTime}`.localeCompare(`${b.lessonDate} ${b.startTime}`),
  );

  const students = journal?.students ?? [];
  const names = shortNames(students.map((student) => student.fullName));
  return students.map((student, index) => {
    const cells = new Map<string, JournalCell>();
    for (const lesson of lessons) {
      if (!lesson.lessonDate || student.studentProfileId == null) continue;
      const mark = markFor(lesson, student.studentProfileId, subgroupFiltered, today);
      if (!mark) continue;
      const cell = cells.get(lesson.lessonDate) ?? { marks: [], title: '' };
      cell.marks.push(mark);
      cell.title = cell.title ? `${cell.title}\n${lessonTitle(lesson, mark)}` : lessonTitle(lesson, mark);
      cells.set(lesson.lessonDate, cell);
    }
    return { student, shortName: names[index], cells };
  });
}
