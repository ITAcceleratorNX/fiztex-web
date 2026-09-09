import { describe, expect, it } from 'vitest';
import type { XlsxWorkbook } from '@/lib/xlsx/readWorkbook';
import {
  matchWeekday,
  parseClassHeader,
  parseScheduleWorkbook,
  parseTimeRange,
} from './parseScheduleWorkbook';

/** Лист как в реальном файле: две колонки на класс, шапка на каждый день. */
function sheet(rows: string[][]): XlsxWorkbook {
  return { sheets: [{ name: '5 кл', rows }] };
}

const HEADER = ['понедельник', '', '5а-1', '', '5а-2', '', '5б', ''];

describe('parseTimeRange', () => {
  it('читает оба разделителя из файла', () => {
    expect(parseTimeRange('07.45 - 08.25')).toEqual({ start: '07:45', end: '08:25' });
    expect(parseTimeRange('13.35-14.15')).toEqual({ start: '13:35', end: '14:15' });
  });

  it('отвергает не время', () => {
    expect(parseTimeRange('первый урок')).toBeNull();
    expect(parseTimeRange('25.00-26.00')).toBeNull();
  });
});

describe('matchWeekday', () => {
  it('узнаёт день по обрезанному слову', () => {
    expect(matchWeekday('понедельн')).toBe('MONDAY');
    expect(matchWeekday('Пятница')).toBe('FRIDAY');
  });

  it('не принимает короткий обрывок за день', () => {
    expect(matchWeekday('ср')).toBeNull();
    expect(matchWeekday('матем ТБ')).toBeNull();
  });
});

describe('parseClassHeader', () => {
  it('делит имя класса и номер группы', () => {
    expect(parseClassHeader('5ә-1')).toEqual({ className: '5ә', groupLabel: '1' });
    expect(parseClassHeader('8F1-2')).toEqual({ className: '8F1', groupLabel: '2' });
  });

  it('класс без деления остаётся целым', () => {
    expect(parseClassHeader('6ә')).toEqual({ className: '6ә', groupLabel: null });
  });
});

describe('parseScheduleWorkbook', () => {
  it('собирает урок всего класса, когда в обеих группах одно и то же', () => {
    const parsed = parseScheduleWorkbook(
      sheet([HEADER, ['07.45 - 08.25', '1', 'матем ТБ', '303', 'матем ТБ', '303', 'физ-ра КШ', '1']]),
    );
    const forA = parsed.lessons.filter((lesson) => lesson.className === '5а');
    expect(forA).toHaveLength(1);
    expect(forA[0].groupLabel).toBeNull();
    expect(forA[0].cells).toHaveLength(2);
  });

  it('оставляет два урока, когда группы учатся разному', () => {
    const parsed = parseScheduleWorkbook(
      sheet([HEADER, ['07.45 - 08.25', '1', 'матем ТБ', '303', 'информ МБ', '113', 'физ-ра КШ', '1']]),
    );
    const forA = parsed.lessons.filter((lesson) => lesson.className === '5а');
    expect(forA.map((lesson) => lesson.groupLabel)).toEqual(['1', '2']);
    expect(forA.map((lesson) => lesson.subjectKey)).toEqual(['MATH', 'INFORMATICS']);
  });

  it('считает одинаковыми ячейки, различающиеся пробелами и регистром инициалов', () => {
    const parsed = parseScheduleWorkbook(
      sheet([HEADER, ['07.45 - 08.25', '1', 'англ.яз  КА', '205', 'англ.яз Ка', '205', '', '']]),
    );
    expect(parsed.lessons.filter((lesson) => lesson.className === '5а')).toHaveLength(1);
  });

  it('опечатка в названии предмета не превращает урок класса в две подгруппы', () => {
    // Так это выглядит в реальном файле: «рус.лит» в одной колонке, «рул.лит» в другой.
    const parsed = parseScheduleWorkbook(
      sheet([HEADER, ['07.45 - 08.25', '1', 'рус.лит МИ', '305', 'рул.лит МИ', '305', '', '']]),
    );
    const forA = parsed.lessons.filter((lesson) => lesson.className === '5а');
    expect(forA).toHaveLength(1);
    expect(forA[0].groupLabel).toBeNull();
    expect(forA[0].subjectKey).toBe('RUS_LITERATURE');
  });

  it('неделимый класс даёт один урок на слот', () => {
    const parsed = parseScheduleWorkbook(
      sheet([HEADER, ['07.45 - 08.25', '1', '', '', '', '', 'физ-ра КШ', '1']]),
    );
    const forB = parsed.lessons.filter((lesson) => lesson.className === '5б');
    expect(forB).toHaveLength(1);
    expect(forB[0].groupLabel).toBeNull();
    expect(forB[0].room).toBe('1');
  });

  it('шапка каждого дня переключает день недели', () => {
    const parsed = parseScheduleWorkbook(
      sheet([
        HEADER,
        ['07.45 - 08.25', '1', 'матем ТБ', '303', 'матем ТБ', '303', '', ''],
        ['вторник', '', '5а-1', '', '5а-2', '', '5б', ''],
        ['07.45 - 08.25', '1', 'химия УУ', '301', 'химия УУ', '301', '', ''],
      ]),
    );
    expect(parsed.lessons.map((lesson) => lesson.weekday)).toEqual(['MONDAY', 'TUESDAY']);
  });

  it('пустая клетка — это окно, а не ошибка', () => {
    const parsed = parseScheduleWorkbook(
      sheet([HEADER, ['07.45 - 08.25', '1', '', '', 'матем ТБ', '303', '', '']]),
    );
    expect(parsed.issues).toHaveLength(0);
    expect(parsed.lessons).toHaveLength(1);
    expect(parsed.lessons[0].groupLabel).toBe('2');
  });

  it('кабинет без предмета попадает в отчёт', () => {
    const parsed = parseScheduleWorkbook(
      sheet([HEADER, ['07.45 - 08.25', '1', '', '303', '', '', '', '']]),
    );
    expect(parsed.issues.map((issue) => issue.code)).toEqual(['EMPTY_CELL']);
  });

  it('повторённая колонка класса в шапке отбрасывается с сообщением', () => {
    const parsed = parseScheduleWorkbook(
      sheet([
        ['понедельник', '', '5а', '', '5а', ''],
        ['07.45 - 08.25', '1', 'матем ТБ', '303', 'химия УУ', '301'],
      ]),
    );
    expect(parsed.issues.map((issue) => issue.code)).toContain('DUPLICATE_COLUMN');
    expect(parsed.lessons).toHaveLength(1);
  });

  it('второй урок в ту же клетку недели — ошибка файла, а не второй урок', () => {
    // Дважды скопированный понедельник: тот же класс, тот же номер урока.
    const parsed = parseScheduleWorkbook(
      sheet([
        ['понедельник', '', '5а', ''],
        ['07.45 - 08.25', '1', 'матем ТБ', '303'],
        ['понедельник', '', '5а', ''],
        ['07.45 - 08.25', '1', 'химия УУ', '301'],
      ]),
    );
    expect(parsed.issues.map((issue) => issue.code)).toEqual(['DUPLICATE_SLOT']);
    expect(parsed.lessons).toHaveLength(1);
    expect(parsed.lessons[0].subjectKey).toBe('MATH');
  });

  it('нераспознанное время сообщается, но урок остаётся', () => {
    const parsed = parseScheduleWorkbook(
      sheet([HEADER, ['первый', '1', 'матем ТБ', '303', 'матем ТБ', '303', '', '']]),
    );
    expect(parsed.issues.map((issue) => issue.code)).toEqual(['BAD_TIME']);
    expect(parsed.lessons).toHaveLength(1);
    expect(parsed.lessons[0].time).toBeNull();
  });

  it('строка с уроками до дня недели не теряется молча', () => {
    const parsed = parseScheduleWorkbook(
      sheet([['07.45 - 08.25', '1', 'матем ТБ', '303']]),
    );
    expect(parsed.issues.map((issue) => issue.code)).toEqual(['NO_HEADER']);
    expect(parsed.lessons).toHaveLength(0);
  });

  it('запоминает адрес ячейки для отчёта', () => {
    const parsed = parseScheduleWorkbook(
      sheet([HEADER, ['07.45 - 08.25', '1', 'матем ТБ', '303', 'информ МБ', '113', '', '']]),
    );
    expect(parsed.lessons[0].cells[0]).toEqual({ sheet: '5 кл', row: 2, column: 3 });
  });

  it('перечисляет классы и дни каждого листа', () => {
    const parsed = parseScheduleWorkbook(
      sheet([HEADER, ['07.45 - 08.25', '1', 'матем ТБ', '303', 'матем ТБ', '303', 'физ-ра КШ', '1']]),
    );
    expect(parsed.sheets[0]).toMatchObject({
      name: '5 кл',
      classNames: ['5а', '5б'],
      weekdays: ['MONDAY'],
      lessonCount: 2,
    });
  });
});
