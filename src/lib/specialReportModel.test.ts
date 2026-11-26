import { describe, expect, it } from 'vitest';
import {
  averageText,
  percentText,
  performanceState,
  showsCategories,
  specialFileStem,
  workStateHint,
} from './specialReportModel';

describe('specialReportModel', () => {
  it('formats percentages with a comma and never turns a missing value into zero', () => {
    expect(percentText(78.57)).toBe('78,57 %');
    expect(percentText(100)).toBe('100,00 %');
    expect(percentText(null)).toBe('Нет данных');
    expect(percentText(undefined, true)).toBe('Недостаточно данных');
    expect(averageText(7.925)).toBe('7,93');
    expect(averageText(null)).toBe('Нет данных');
  });

  it('explains works that have nothing to count', () => {
    expect(workStateHint({ state: 'OK', invalidResultCount: 0 })).toBeNull();
    expect(workStateHint({ state: 'NO_DATA', invalidResultCount: 0 })).toMatch(/Нет ни одного/);
    expect(workStateHint({ state: 'INVALID_MAX', invalidResultCount: 1 })).toMatch(/максимум/);
    expect(workStateHint({ state: 'OK', invalidResultCount: 2 })).toMatch(/: 2$/);
  });

  it('names every performance row state', () => {
    expect(performanceState({ state: 'OK' }).label).toBe('Посчитано');
    expect(performanceState({ state: 'INCOMPLETE', missing: 2 }).hint).toMatch(/у 2 уч/);
    expect(performanceState({ state: 'SCALE_NOT_SUPPORTED', scaleMax: 5 }).hint).toMatch(/до 5/);
    expect(performanceState({ state: 'PASS_FAIL' }).label).toBe('Зачётный предмет');
    expect(performanceState({ state: 'ROSTER_UNAVAILABLE' }).hint).toMatch(/состав подгруппы/);
    expect(performanceState({ state: 'NOT_APPLICABLE', finalPeriodName: '2 четверть' }).hint).toMatch(/2 четверть/);
    expect(showsCategories({ state: 'INCOMPLETE' })).toBe(true);
    expect(showsCategories({ state: 'PASS_FAIL' })).toBe(false);
  });

  it('builds a safe file name from the filters', () => {
    expect(specialFileStem('assessment', ['2026/2027', null, '7А'])).toBe('Анализ СОР и СОЧ 2026-2027 7А');
  });
});
