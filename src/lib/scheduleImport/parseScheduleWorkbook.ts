/**
 * Разбор книги школьного расписания в плоский список уроков.
 *
 * Формат файла — не таблица записей, а сетка: строки это звонки, колонки — классы,
 * и каждый день начинается новой шапкой посреди листа. Поэтому разбор идёт не по
 * заголовку столбцов, а по координатам: строка с названием дня объявляет шапку,
 * следующие строки до следующего дня — уроки.
 *
 * Один класс занимает пару колонок «предмет + кабинет» на каждую свою группу
 * («5ә-1», «5ә-2»), а неделимый класс — одну пару («6ә»). Если в обеих колонках
 * слота стоит одно и то же, это урок всего класса, а не два одинаковых урока по
 * подгруппам: делением здесь и отличается «англ яз» от «матем ТБ / информ МБ».
 *
 * Разбор ничего не знает о справочниках школы — он отвечает только на вопрос
 * «что написано в файле». Сопоставление с классами, предметами и учителями —
 * дальше, в `resolveScheduleImport`.
 */

import type { Weekday } from '@/lib/scheduleSettingsTypes';
import type { XlsxWorkbook } from '@/lib/xlsx/readWorkbook';
import { parseSubjectCell } from './subjectDictionary';

const WEEKDAY_NAMES: Array<{ weekday: Weekday; names: string[] }> = [
  { weekday: 'MONDAY', names: ['понедельник', 'дүйсенбі'] },
  { weekday: 'TUESDAY', names: ['вторник', 'сейсенбі'] },
  { weekday: 'WEDNESDAY', names: ['среда', 'сәрсенбі'] },
  { weekday: 'THURSDAY', names: ['четверг', 'бейсенбі'] },
  { weekday: 'FRIDAY', names: ['пятница', 'жұма'] },
  { weekday: 'SATURDAY', names: ['суббота', 'сенбі'] },
  { weekday: 'SUNDAY', names: ['воскресенье', 'жексенбі'] },
];

/** Короче четырёх букв день не опознаём: «ср» слишком похоже на данные. */
const MIN_WEEKDAY_PREFIX = 4;

/**
 * День недели по ячейке.
 *
 * По префиксу, а не по равенству: в файле встречается «понедельн» — колонка узкая,
 * и слово обрезали руками. Отвергать из-за этого целый день листа незачем.
 */
export function matchWeekday(text: string): Weekday | null {
  const value = text.trim().toLowerCase().replace(/ё/g, 'е');
  if (value.length < MIN_WEEKDAY_PREFIX) return null;
  for (const { weekday, names } of WEEKDAY_NAMES) {
    if (names.some((name) => name.startsWith(value) || value.startsWith(name))) return weekday;
  }
  return null;
}

export interface ParsedTimeRange {
  start: string;
  end: string;
}

/** «07.45 - 08.25» и «13.35-14.15» — один формат с разными разделителями. */
export function parseTimeRange(text: string): ParsedTimeRange | null {
  const match = /^(\d{1,2})[.:](\d{2})\s*[-—–]\s*(\d{1,2})[.:](\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [, startHour, startMinute, endHour, endMinute] = match;
  const hours = [Number(startHour), Number(endHour)];
  const minutes = [Number(startMinute), Number(endMinute)];
  if (hours.some((h) => h > 23) || minutes.some((m) => m > 59)) return null;
  return {
    start: `${startHour.padStart(2, '0')}:${startMinute}`,
    end: `${endHour.padStart(2, '0')}:${endMinute}`,
  };
}

export interface ParsedClassColumn {
  className: string;
  /** Метка группы из шапки: «1», «2». `null` — класс не делят. */
  groupLabel: string | null;
  /** Колонка предмета, 1-based — как в адресе ячейки Excel. */
  column: number;
}

/**
 * «5ә-1» → класс «5ә», группа «1». Хвост отделяем только если перед ним что-то
 * осталось: класс с именем «8-1» иначе превратился бы в класс «8».
 */
export function parseClassHeader(text: string): { className: string; groupLabel: string | null } {
  const value = text.trim().replace(/\s+/g, ' ');
  const match = /^(.*\S)\s*-\s*(\d+)$/.exec(value);
  if (match) return { className: match[1], groupLabel: match[2] };
  return { className: value, groupLabel: null };
}

export interface ParsedCellLocation {
  sheet: string;
  /** 1-based, как в Excel: номер строки нужен человеку, который правит файл. */
  row: number;
  column: number;
}

export interface ParsedLesson {
  className: string;
  /** `null` — урок всего класса. Иначе метка группы из шапки файла. */
  groupLabel: string | null;
  weekday: Weekday;
  lessonNumber: number;
  time: ParsedTimeRange | null;
  /** Исходный текст ячейки — его показываем в отчёте о проблемах. */
  raw: string;
  subjectKey: string | null;
  subjectText: string;
  teacherInitials: string;
  room: string;
  /** Ячейки, из которых собран урок: у неделимого слота их две. */
  cells: ParsedCellLocation[];
}

export type ParseIssueCode =
  | 'NO_HEADER'
  | 'UNKNOWN_WEEKDAY'
  | 'BAD_LESSON_NUMBER'
  | 'BAD_TIME'
  | 'EMPTY_CELL'
  | 'DUPLICATE_COLUMN'
  | 'DUPLICATE_SLOT';

export interface ParseIssue {
  code: ParseIssueCode;
  message: string;
  location: ParsedCellLocation;
  className?: string;
}

export interface ParsedSheet {
  name: string;
  classNames: string[];
  weekdays: Weekday[];
  lessonCount: number;
}

export interface ParsedWorkbook {
  lessons: ParsedLesson[];
  issues: ParseIssue[];
  sheets: ParsedSheet[];
}

interface SlotEntry {
  column: ParsedClassColumn;
  raw: string;
  room: string;
  location: ParsedCellLocation;
}

/** Одинаковы ли ячейки двух групп по смыслу: пробелы и регистр инициалов не в счёт. */
function sameLesson(a: ParsedLesson, b: ParsedLesson): boolean {
  return (
    (a.subjectKey ?? a.subjectText.toLowerCase()) === (b.subjectKey ?? b.subjectText.toLowerCase()) &&
    a.teacherInitials === b.teacherInitials &&
    a.room === b.room
  );
}

function toLesson(
  entry: SlotEntry,
  weekday: Weekday,
  lessonNumber: number,
  time: ParsedTimeRange | null,
): ParsedLesson {
  const parts = parseSubjectCell(entry.raw);
  return {
    className: entry.column.className,
    groupLabel: entry.column.groupLabel,
    weekday,
    lessonNumber,
    time,
    raw: entry.raw,
    subjectKey: parts.subjectKey,
    subjectText: parts.subjectText,
    // Регистр инициалов в файле гуляет («Ка» рядом с «КА») — сверять их так нельзя.
    teacherInitials: parts.teacherText.toUpperCase().replace(/\s+/g, ''),
    room: entry.room,
    cells: [entry.location],
  };
}

function readHeader(
  row: string[],
  rowNumber: number,
  sheetName: string,
  issues: ParseIssue[],
): ParsedClassColumn[] {
  const columns: ParsedClassColumn[] = [];
  const seen = new Map<string, number>();
  // Первые две колонки — время и номер урока, классы начинаются с третьей.
  for (let index = 2; index < row.length; index++) {
    const text = (row[index] ?? '').trim();
    if (!text) continue;
    const { className, groupLabel } = parseClassHeader(text);
    if (!className) continue;
    const key = `${className}|${groupLabel ?? ''}`;
    const location = { sheet: sheetName, row: rowNumber, column: index + 1 };
    if (seen.has(key)) {
      issues.push({
        code: 'DUPLICATE_COLUMN',
        className,
        location,
        message: `Колонка «${text}» повторяется в шапке дня`,
      });
      continue;
    }
    seen.set(key, index);
    columns.push({ className, groupLabel, column: index + 1 });
  }
  return columns;
}

export function parseScheduleWorkbook(workbook: XlsxWorkbook): ParsedWorkbook {
  const lessons: ParsedLesson[] = [];
  const issues: ParseIssue[] = [];
  const sheets: ParsedSheet[] = [];

  for (const sheet of workbook.sheets) {
    let header: ParsedClassColumn[] | null = null;
    let weekday: Weekday | null = null;
    const sheetClasses = new Set<string>();
    const sheetWeekdays: Weekday[] = [];
    // Ключ слота: класс + группа + день + номер урока. Второй урок в ту же клетку
    // расписания — не «ещё один урок», а ошибка файла.
    const takenSlots = new Set<string>();
    let sheetLessons = 0;

    for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex++) {
      const row = sheet.rows[rowIndex];
      const rowNumber = rowIndex + 1;
      const first = (row[0] ?? '').trim();
      const second = (row[1] ?? '').trim();

      if (first && !second) {
        const matched = matchWeekday(first);
        if (matched) {
          weekday = matched;
          if (!sheetWeekdays.includes(matched)) sheetWeekdays.push(matched);
          header = readHeader(row, rowNumber, sheet.name, issues);
          for (const column of header) sheetClasses.add(column.className);
          continue;
        }
        // Строка без номера урока и с неизвестным словом — подпись или итог, не день.
        continue;
      }

      if (!first && !second) continue;
      if (!header || !weekday) {
        if (row.some((cell) => (cell ?? '').trim())) {
          issues.push({
            code: 'NO_HEADER',
            location: { sheet: sheet.name, row: rowNumber, column: 1 },
            message: 'Строка с уроками идёт до строки с днём недели',
          });
        }
        continue;
      }

      const lessonNumber = Number(second);
      if (!Number.isInteger(lessonNumber) || lessonNumber < 1) {
        issues.push({
          code: 'BAD_LESSON_NUMBER',
          location: { sheet: sheet.name, row: rowNumber, column: 2 },
          message: `Номер урока не распознан: «${second}»`,
        });
        continue;
      }

      const time = parseTimeRange(first);
      if (first && !time) {
        issues.push({
          code: 'BAD_TIME',
          location: { sheet: sheet.name, row: rowNumber, column: 1 },
          message: `Время урока не распознано: «${first}»`,
        });
      }

      // Копия под `const`: TypeScript теряет сужение `weekday` внутри замыканий ниже.
      const day = weekday;
      const byClass = new Map<string, SlotEntry[]>();
      for (const column of header) {
        const raw = (row[column.column - 1] ?? '').trim();
        const room = (row[column.column] ?? '').trim();
        const location = { sheet: sheet.name, row: rowNumber, column: column.column };
        if (!raw) {
          // Пустая клетка — это «окно», а не поломка: сообщаем, но не мешаем импорту.
          if (room) {
            issues.push({
              code: 'EMPTY_CELL',
              className: column.className,
              location,
              message: `Кабинет «${room}» указан без предмета`,
            });
          }
          continue;
        }
        const list = byClass.get(column.className) ?? [];
        list.push({ column, raw, room, location });
        byClass.set(column.className, list);
      }

      for (const [className, entries] of byClass) {
        const parsed = entries.map((entry) => toLesson(entry, day, lessonNumber, time));
        const columnsForClass = header.filter((column) => column.className === className).length;
        const collapse =
          parsed.length > 1 &&
          parsed.length === columnsForClass &&
          parsed.every((lesson) => sameLesson(lesson, parsed[0]));

        const produced = collapse
          ? [{ ...parsed[0], groupLabel: null, cells: parsed.flatMap((lesson) => lesson.cells) }]
          : parsed;

        for (const lesson of produced) {
          const key = `${className}|${lesson.groupLabel ?? ''}|${day}|${lessonNumber}`;
          if (takenSlots.has(key)) {
            issues.push({
              code: 'DUPLICATE_SLOT',
              className,
              location: lesson.cells[0],
              message: `Для «${className}» уже есть урок ${lessonNumber} в этот день`,
            });
            continue;
          }
          takenSlots.add(key);
          lessons.push(lesson);
          sheetLessons++;
        }
      }
    }

    sheets.push({
      name: sheet.name,
      classNames: [...sheetClasses],
      weekdays: sheetWeekdays,
      lessonCount: sheetLessons,
    });
  }

  return { lessons, issues, sheets };
}
