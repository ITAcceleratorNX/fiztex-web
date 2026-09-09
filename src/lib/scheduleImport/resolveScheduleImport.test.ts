import { describe, expect, it } from 'vitest';
import type { XlsxWorkbook } from '@/lib/xlsx/readWorkbook';
import { parseScheduleWorkbook } from './parseScheduleWorkbook';
import {
  EMPTY_OVERRIDES,
  resolveScheduleImport,
  teacherInitialVariants,
  type ClassContext,
  type ImportOverrides,
  type SchoolCatalogs,
} from './resolveScheduleImport';

const HEADER = ['понедельник', '', '5а-1', '', '5а-2', ''];

function parse(rows: string[][]) {
  const workbook: XlsxWorkbook = { sheets: [{ name: '5 кл', rows }] };
  return parseScheduleWorkbook(workbook).lessons;
}

const CATALOGS: SchoolCatalogs = {
  classes: [{ id: 1, name: '5А' }],
  subjects: [
    { id: 10, name: 'Математика' },
    { id: 11, name: 'Информатика' },
    { id: 12, name: 'Художественный труд' },
  ],
  teachers: [
    { id: 100, fullName: 'Тулегенова Бота Ержановна', subjectIds: [10] },
    { id: 101, fullName: 'Мукашева Бану Асхатовна', subjectIds: [11] },
    { id: 102, fullName: 'Тлеубаева Бахыт Сериковна', subjectIds: [11] },
    { id: 103, fullName: 'Ахметова Гулим Сериковна', subjectIds: [12] },
  ],
};

const CONTEXT: ClassContext = {
  bellTemplateId: 7,
  bellTemplateName: 'Первая смена',
  periods: [
    { id: 71, bellTemplateId: 7, lessonNumber: 1, startTime: '07:45:00', endTime: '08:25:00', sortOrder: 0 },
    { id: 72, bellTemplateId: 7, lessonNumber: 2, startTime: '08:30:00', endTime: '09:10:00', sortOrder: 1 },
  ],
  groupSets: [
    { id: 5, name: 'Деление класса', subgroups: [{ id: 51, name: 'Группа 1' }, { id: 52, name: 'Группа 2' }] },
  ],
};

function resolve(rows: string[][], overrides: ImportOverrides = EMPTY_OVERRIDES, context = CONTEXT) {
  return resolveScheduleImport(
    parse(rows),
    CATALOGS,
    new Map([['5а', context]]),
    overrides,
  );
}

describe('teacherInitialVariants', () => {
  it('даёт двух- и трёхбуквенный вариант инициалов', () => {
    expect(teacherInitialVariants('Тулегенова Бота Ержановна')).toEqual(['ТБ', 'ТБЕ']);
  });
});

describe('resolveScheduleImport', () => {
  it('собирает урок всего класса из совпадающих колонок', () => {
    const result = resolve([HEADER, ['07.45 - 08.25', '1', 'матем ТБ', '303', 'матем ТБ', '303']]);
    expect(result.plans[0].lessons).toHaveLength(1);
    expect(result.plans[0].lessons[0]).toMatchObject({
      weekday: 'MONDAY',
      lessonPeriodId: 71,
      subjectId: 10,
      teacherId: 100,
      targetType: 'CLASS',
      subgroupId: null,
      room: '303',
    });
  });

  it('раскладывает разделённый слот по подгруппам класса', () => {
    const result = resolve([HEADER, ['07.45 - 08.25', '1', 'матем ТБ', '303', 'информ МБ', '113']]);
    expect(result.plans[0].lessons.map((lesson) => [lesson.targetType, lesson.subgroupId])).toEqual([
      ['SUBGROUP', 51],
      ['SUBGROUP', 52],
    ]);
  });

  it('находит класс, несмотря на регистр и латиницу в имени', () => {
    const result = resolve([HEADER, ['07.45 - 08.25', '1', 'матем ТБ', '303', 'матем ТБ', '303']]);
    expect(result.plans[0].classId).toBe(1);
  });

  it('класс вне справочника блокирует свои уроки и предлагает выбор', () => {
    const rows = [['понедельник', '', '9Z', ''], ['07.45 - 08.25', '1', 'матем ТБ', '303']];
    const result = resolveScheduleImport(parse(rows), CATALOGS, new Map(), EMPTY_OVERRIDES);
    expect(result.plans[0].ready).toBe(false);
    const problem = result.problems.find((item) => item.code === 'CLASS_NOT_FOUND');
    expect(problem?.candidates).toEqual([{ id: 1, label: '5А' }]);
  });

  it('одинаковые инициалы у двух учителей — выбор администратора, а не догадка', () => {
    // «МБ» — и Мукашева Бану, и (после смены предмета) Тлеубаева Бахыт не подходит;
    // добавим второго с теми же инициалами по тому же предмету.
    const catalogs: SchoolCatalogs = {
      ...CATALOGS,
      teachers: [
        ...CATALOGS.teachers,
        { id: 104, fullName: 'Мусаев Бекзат Ерланович', subjectIds: [11] },
      ],
    };
    const result = resolveScheduleImport(
      parse([HEADER, ['07.45 - 08.25', '1', 'информ МБ', '113', 'матем ТБ', '303']]),
      catalogs,
      new Map([['5а', CONTEXT]]),
      EMPTY_OVERRIDES,
    );
    const problem = result.problems.find((item) => item.code === 'TEACHER_AMBIGUOUS');
    expect(problem?.value).toBe('МБ');
    expect(problem?.candidates?.map((c) => c.id)).toEqual([101, 104]);
    expect(result.plans[0].ready).toBe(false);
  });

  it('однофамильцев различает предмет, если он оставляет одного', () => {
    // «ТБ» есть у Тулегеновой (математика) и Тлеубаевой (информатика).
    const result = resolve([HEADER, ['07.45 - 08.25', '1', 'матем ТБ', '303', 'матем ТБ', '303']]);
    expect(result.plans[0].lessons[0].teacherId).toBe(100);
    expect(result.problems.some((item) => item.code === 'TEACHER_AMBIGUOUS')).toBe(false);
  });

  it('ручной выбор учителя снимает неоднозначность', () => {
    const catalogs: SchoolCatalogs = {
      ...CATALOGS,
      teachers: [
        ...CATALOGS.teachers,
        { id: 104, fullName: 'Мусаев Бекзат Ерланович', subjectIds: [11] },
      ],
    };
    const result = resolveScheduleImport(
      parse([HEADER, ['07.45 - 08.25', '1', 'информ МБ', '113', 'матем ТБ', '303']]),
      catalogs,
      new Map([['5а', CONTEXT]]),
      { ...EMPTY_OVERRIDES, teachers: { МБ: 104 } },
    );
    expect(result.plans[0].lessons.find((l) => l.subjectId === 11)?.teacherId).toBe(104);
    expect(result.plans[0].ready).toBe(true);
  });

  it('предмет без учителя в файле требует решения, а не подставляется сам', () => {
    const result = resolve([HEADER, ['07.45 - 08.25', '1', 'худ труд', '5', 'худ труд', '5']]);
    const problem = result.problems.find((item) => item.code === 'TEACHER_MISSING');
    expect(problem?.value).toBe('Художественный труд');
    expect(result.plans[0].lessons).toHaveLength(0);
  });

  it('выбранный учитель по умолчанию закрывает уроки без учителя', () => {
    const result = resolve([HEADER, ['07.45 - 08.25', '1', 'худ труд', '5', 'худ труд', '5']], {
      ...EMPTY_OVERRIDES,
      subjectTeachers: { ART_LABOUR: 103 },
    });
    expect(result.plans[0].lessons[0].teacherId).toBe(103);
    expect(result.plans[0].ready).toBe(true);
  });

  it('предмет вне справочника школы блокирует урок', () => {
    const result = resolve([HEADER, ['07.45 - 08.25', '1', 'химия УУ', '301', 'химия УУ', '301']]);
    expect(result.problems.map((item) => item.code)).toContain('SUBJECT_NOT_FOUND');
    expect(result.plans[0].lessons).toHaveLength(0);
  });

  it('класс без шаблона звонков не получает расписания', () => {
    const result = resolve(
      [HEADER, ['07.45 - 08.25', '1', 'матем ТБ', '303', 'матем ТБ', '303']],
      EMPTY_OVERRIDES,
      { bellTemplateId: null, bellTemplateName: null, periods: [], groupSets: [] },
    );
    expect(result.problems.map((item) => item.code)).toContain('NO_BELL_TEMPLATE');
    expect(result.plans[0].ready).toBe(false);
  });

  it('номера урока нет в шаблоне — урок не создаётся', () => {
    const result = resolve([HEADER, ['12.35 - 13.15', '7', 'матем ТБ', '303', 'матем ТБ', '303']]);
    const problem = result.problems.find((item) => item.code === 'PERIOD_NOT_FOUND');
    expect(problem?.value).toBe('7');
    expect(result.plans[0].lessons).toHaveLength(0);
  });

  it('расхождение времени со звонком — предупреждение, а не отказ', () => {
    const result = resolve([HEADER, ['08.00 - 08.40', '1', 'матем ТБ', '303', 'матем ТБ', '303']]);
    const problem = result.problems.find((item) => item.code === 'TIME_MISMATCH');
    expect(problem?.severity).toBe('warning');
    expect(result.plans[0].ready).toBe(true);
  });

  it('учитель не по своему предмету — предупреждение, урок остаётся', () => {
    // Мукашева Бану («МБ») закреплена за информатикой, а ведёт здесь математику.
    const result = resolve([HEADER, ['07.45 - 08.25', '1', 'матем МБ', '303', 'матем МБ', '303']]);
    expect(result.problems.map((item) => item.code)).toContain('TEACHER_SUBJECT_MISMATCH');
    expect(result.plans[0].ready).toBe(true);
  });

  it('подгруппы нет у класса — слот блокируется', () => {
    const result = resolve(
      [HEADER, ['07.45 - 08.25', '1', 'матем ТБ', '303', 'информ МБ', '113']],
      EMPTY_OVERRIDES,
      { ...CONTEXT, groupSets: [] },
    );
    expect(result.problems.map((item) => item.code)).toContain('SUBGROUP_NOT_FOUND');
  });

  it('несколько подгрупп с одним номером — выбор администратора', () => {
    const result = resolve(
      [HEADER, ['07.45 - 08.25', '1', 'матем ТБ', '303', 'информ МБ', '113']],
      EMPTY_OVERRIDES,
      {
        ...CONTEXT,
        groupSets: [
          { id: 5, name: 'Английский', subgroups: [{ id: 51, name: 'Группа 1' }, { id: 52, name: 'Группа 2' }] },
          { id: 6, name: 'Информатика', subgroups: [{ id: 61, name: 'Группа 1' }, { id: 62, name: 'Группа 2' }] },
        ],
      },
    );
    const problem = result.problems.find((item) => item.code === 'SUBGROUP_AMBIGUOUS');
    expect(problem?.candidates?.map((c) => c.label)).toContain('Группа 1 · Английский');
  });

  it('одинаковая проблема из разных уроков — одна строка отчёта с примерами', () => {
    const result = resolve([
      HEADER,
      ['07.45 - 08.25', '1', 'химия УУ', '301', 'химия УУ', '301'],
      ['08.30 - 09.10', '2', 'химия УУ', '301', 'химия УУ', '301'],
    ]);
    const problem = result.problems.find((item) => item.code === 'SUBJECT_NOT_FOUND');
    expect(problem?.lessonCount).toBe(2);
    expect(problem?.examples).toEqual(['5 кл · строка 2', '5 кл · строка 3']);
  });

  it('считает итоги по классам и урокам', () => {
    const result = resolve([
      HEADER,
      ['07.45 - 08.25', '1', 'матем ТБ', '303', 'матем ТБ', '303'],
      ['08.30 - 09.10', '2', 'химия УУ', '301', 'химия УУ', '301'],
    ]);
    expect(result.totals).toEqual({
      lessons: 2,
      ready: 1,
      blocked: 1,
      classesReady: 0,
      classesBlocked: 1,
    });
  });
});
