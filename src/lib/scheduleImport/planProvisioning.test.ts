import { describe, expect, it } from 'vitest';
import type { XlsxWorkbook } from '@/lib/xlsx/readWorkbook';
import { parseScheduleWorkbook } from './parseScheduleWorkbook';
import { isProvisioningPlanEmpty, planProvisioning, splitClassName } from './planProvisioning';
import type { ClassContext, SchoolCatalogs } from './resolveScheduleImport';

const HEADER = ['понедельник', '', '5а-1', '', '5а-2', '', '9F1', ''];

function parse(rows: string[][]) {
  const workbook: XlsxWorkbook = { sheets: [{ name: '5 кл', rows }] };
  return parseScheduleWorkbook(workbook).lessons;
}

const ROWS = [
  HEADER,
  ['07.45 - 08.25', '1', 'матем ТБ', '303', 'информ МБ', '113', 'химия УУ', '301'],
  ['08.30 - 09.10', '2', 'худ труд', '5', 'худ труд', '5', 'физ-ра КШ', '1'],
];

const EMPTY_CATALOGS: SchoolCatalogs = { classes: [], subjects: [], teachers: [] };

const FULL_CONTEXT: ClassContext = {
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

describe('splitClassName', () => {
  it('делит имя на параллель и литеру', () => {
    expect(splitClassName('5ә')).toEqual({ grade: '5', letter: 'ә' });
    expect(splitClassName('10F1')).toEqual({ grade: '10', letter: 'F1' });
    expect(splitClassName('11S')).toEqual({ grade: '11', letter: 'S' });
  });

  it('имя без параллели завести нельзя', () => {
    expect(splitClassName('Спецкурс')).toBeNull();
  });
});

describe('planProvisioning', () => {
  it('перечисляет классы файла, которых нет в школе', () => {
    const plan = planProvisioning(parse(ROWS), EMPTY_CATALOGS, new Map());
    expect(plan.classes.map((item) => [item.name, item.grade, item.letter])).toEqual([
      ['5а', '5', 'а'],
      ['9F1', '9', 'F1'],
    ]);
  });

  it('предмет предлагает под каноническим названием, а не как в файле', () => {
    const plan = planProvisioning(parse(ROWS), EMPTY_CATALOGS, new Map());
    expect(plan.subjects.map((item) => item.name)).toContain('Художественный труд');
    expect(plan.subjects.map((item) => item.name)).toContain('Физическая культура');
  });

  it('не предлагает предмет, который в справочнике назван иначе', () => {
    const catalogs: SchoolCatalogs = {
      ...EMPTY_CATALOGS,
      subjects: [{ id: 10, name: 'Математика' }],
    };
    const plan = planProvisioning(parse(ROWS), catalogs, new Map());
    expect(plan.subjects.map((item) => item.name)).not.toContain('Математика');
  });

  it('собирает шаблон звонков из времени в файле', () => {
    const plan = planProvisioning(parse(ROWS), EMPTY_CATALOGS, new Map());
    expect(plan.bellTemplates).toHaveLength(1);
    expect(plan.bellTemplates[0]).toMatchObject({
      name: 'Звонки 07:45–09:10',
      classNames: ['5а', '9F1'],
    });
    expect(plan.bellTemplates[0].periods).toEqual([
      { lessonNumber: 1, startTime: '07:45', endTime: '08:25' },
      { lessonNumber: 2, startTime: '08:30', endTime: '09:10' },
    ]);
  });

  it('разные смены дают разные шаблоны, а не один общий', () => {
    const rows = [
      ['понедельник', '', '5а', '', '6а', ''],
      ['07.45 - 08.25', '1', 'матем ТБ', '303', '', ''],
      ['13.35-14.15', '1', '', '', 'матем ТБ', '303'],
    ];
    const plan = planProvisioning(parse(rows), EMPTY_CATALOGS, new Map());
    expect(plan.bellTemplates.map((item) => [item.name, item.classNames])).toEqual([
      ['Звонки 07:45–08:25', ['5а']],
      ['Звонки 13:35–14:15', ['6а']],
    ]);
  });

  it('класс с привязанным звонком в шаблоны не попадает', () => {
    const contexts = new Map<string, ClassContext>([['5а', FULL_CONTEXT], ['9F1', FULL_CONTEXT]]);
    const plan = planProvisioning(parse(ROWS), EMPTY_CATALOGS, contexts);
    expect(plan.bellTemplates).toHaveLength(0);
  });

  it('подгруппы предлагает только там, где класс в файле делят', () => {
    const plan = planProvisioning(parse(ROWS), EMPTY_CATALOGS, new Map());
    expect(plan.subgroups).toEqual([{ className: '5а', labels: ['1', '2'] }]);
  });

  it('существующие подгруппы класса не дублируются', () => {
    const contexts = new Map<string, ClassContext>([['5а', FULL_CONTEXT]]);
    const plan = planProvisioning(parse(ROWS), EMPTY_CATALOGS, contexts);
    expect(plan.subgroups).toHaveLength(0);
  });

  it('учителей план не содержит: их из инициалов не создать', () => {
    const plan = planProvisioning(parse(ROWS), EMPTY_CATALOGS, new Map());
    expect(plan).not.toHaveProperty('teachers');
  });

  it('пустой план — когда создавать нечего, даже если учителя не найдены', () => {
    const catalogs: SchoolCatalogs = {
      classes: [{ id: 1, name: '5а' }],
      subjects: [
        { id: 10, name: 'Математика' },
        { id: 11, name: 'Информатика' },
        { id: 12, name: 'Художественный труд' },
      ],
      teachers: [],
    };
    const rows = [
      ['понедельник', '', '5а-1', '', '5а-2', ''],
      ['07.45 - 08.25', '1', 'матем ТБ', '303', 'информ МБ', '113'],
    ];
    const contexts = new Map<string, ClassContext>([['5а', FULL_CONTEXT]]);
    const plan = planProvisioning(parse(rows), catalogs, contexts);
    // Учителей «ТБ» и «МБ» в школе нет, но шаг создания к ним отношения не имеет:
    // это строки отчёта, а не то, что можно завести.
    expect(isProvisioningPlanEmpty(plan)).toBe(true);
  });
});
