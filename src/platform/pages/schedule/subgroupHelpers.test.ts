import { describe, expect, it } from 'vitest';
import {
  autoSplitSizes,
  compareStudentsByName,
  defaultAutoSplitNames,
  diffMembership,
  duplicateStudentIds,
  membershipEquals,
  parseStudentAlreadyInSetDetails,
  parseSubgroupsInUseDetails,
  sortStudentsByName,
  studentInitials,
  studentShortName,
} from './subgroupHelpers';

describe('autoSplitSizes (mirror SubgroupAutoSplitter)', () => {
  it('25 → 13 / 12', () => {
    expect(autoSplitSizes(25, 2)).toEqual([13, 12]);
  });

  it('even count → equal halves', () => {
    expect(autoSplitSizes(10, 2)).toEqual([5, 5]);
  });

  it('empty roster → zeros', () => {
    expect(autoSplitSizes(0, 2)).toEqual([0, 0]);
  });

  it('1 student → 1 / 0', () => {
    expect(autoSplitSizes(1, 2)).toEqual([1, 0]);
  });
});

describe('defaultAutoSplitNames', () => {
  it('defaults Группа 1/2', () => {
    expect(defaultAutoSplitNames()).toEqual(['Группа 1', 'Группа 2']);
  });
});

describe('sortStudentsByName', () => {
  it('orders by last/first/middle (ru)', () => {
    const sorted = sortStudentsByName([
      { lastName: 'Яковлев', firstName: 'А', middleName: null },
      { lastName: 'Иванов', firstName: 'Б', middleName: null },
      { lastName: 'Иванов', firstName: 'А', middleName: null },
    ]);
    expect(sorted.map((s) => studentShortName(s))).toEqual([
      'Иванов А.',
      'Иванов Б.',
      'Яковлев А.',
    ]);
  });

  it('compareStudentsByName is stable for identical names', () => {
    const a = { lastName: 'А', firstName: 'Б', middleName: null };
    expect(compareStudentsByName(a, a)).toBe(0);
  });
});

describe('подписи учеников (2015:12126, 2015:12127)', () => {
  const ivanov = { lastName: 'Иванов', firstName: 'Алексей', middleName: 'Петрович' };

  it('короткое имя — фамилия и инициал', () => {
    expect(studentShortName(ivanov)).toBe('Иванов А.');
  });

  it('без имени — только фамилия', () => {
    expect(studentShortName({ lastName: 'Иванов', firstName: '', middleName: null })).toBe(
      'Иванов',
    );
  });

  it('инициалы для аватара', () => {
    expect(studentInitials(ivanov)).toBe('ИА');
  });
});

describe('diffMembership', () => {
  it('перенос ученика: сначала удаление, потом добавление', () => {
    const diff = diffMembership({ 1: [10, 11], 2: [12] }, { 1: [11], 2: [12, 10] });
    expect(diff.removals).toEqual([{ subgroupId: 1, studentId: 10 }]);
    expect(diff.additions).toEqual([{ subgroupId: 2, studentIds: [10] }]);
  });

  it('добавления одной подгруппы уходят одним запросом', () => {
    const diff = diffMembership({ 1: [] }, { 1: [10, 11, 12] });
    expect(diff.removals).toEqual([]);
    expect(diff.additions).toEqual([{ subgroupId: 1, studentIds: [10, 11, 12] }]);
  });

  it('без изменений — пустой diff', () => {
    expect(membershipEquals({ 1: [10], 2: [] }, { 1: [10], 2: [] })).toBe(true);
    expect(membershipEquals({ 1: [10] }, { 1: [] })).toBe(false);
  });

  it('порядок внутри подгруппы не считается изменением', () => {
    expect(membershipEquals({ 1: [10, 11] }, { 1: [11, 10] })).toBe(true);
  });
});

describe('duplicateStudentIds', () => {
  it('находит ученика в двух подгруппах', () => {
    expect(duplicateStudentIds({ 1: [10, 11], 2: [11, 12] })).toEqual([11]);
  });

  it('повтор внутри одной подгруппы дублем не считается', () => {
    expect(duplicateStudentIds({ 1: [10, 10] })).toEqual([]);
  });
});

describe('conflict detail parsers', () => {
  it('parseStudentAlreadyInSetDetails', () => {
    expect(
      parseStudentAlreadyInSetDetails([
        { studentId: 1, subgroupId: 2, subgroupName: 'Группа 1' },
        { studentId: 'x' },
      ]),
    ).toEqual([{ studentId: 1, subgroupId: 2, subgroupName: 'Группа 1' }]);
  });

  it('parseSubgroupsInUseDetails accepts name (backend) and legacy subgroupName', () => {
    expect(
      parseSubgroupsInUseDetails([
        { subgroupId: 9, name: 'А', lessonCount: 3 },
        { subgroupId: 8, subgroupName: 'Б', lessonCount: 1 },
      ]),
    ).toEqual([
      { subgroupId: 9, name: 'А', lessonCount: 3 },
      { subgroupId: 8, name: 'Б', lessonCount: 1 },
    ]);
  });
});
