import { describe, expect, it } from 'vitest';
import {
  autoSplitSizes,
  compareStudentsByName,
  defaultAutoSplitNames,
  parseStudentAlreadyInSetDetails,
  parseSubgroupsInUseDetails,
  sortStudentsByName,
  studentFullName,
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
    expect(sorted.map((s) => studentFullName(s))).toEqual([
      'Иванов А',
      'Иванов Б',
      'Яковлев А',
    ]);
  });

  it('compareStudentsByName is stable for identical names', () => {
    const a = { lastName: 'А', firstName: 'Б', middleName: null };
    expect(compareStudentsByName(a, a)).toBe(0);
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
