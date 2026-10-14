import { describe, expect, it } from 'vitest';
import {
  changeBadge,
  compareLabel,
  emptyReason,
  formatIndicator,
  notGraded,
  pointKind,
  pointValue,
  sortByChange,
  windowLabel,
  type DynamicsMetric,
} from './dynamicsModel';

const metric = (trend: DynamicsMetric['trend'], change: number | null = null): DynamicsMetric => ({
  current: { state: 'AVAILABLE', mode: 'SCALE_AVERAGE', value: 6.7 }, trend, change,
});

describe('dynamicsModel', () => {
  it('shows the server value and change, never a zero for missing data', () => {
    expect(formatIndicator({ state: 'AVAILABLE', mode: 'SCALE_AVERAGE', value: 8.1 })).toBe('8,1');
    expect(formatIndicator({ state: 'AVAILABLE', mode: 'POLICY_PERCENT', value: 84.2 })).toBe('84,2%');
    expect(formatIndicator({ state: 'NO_DATA', value: null })).toBeNull();
    expect(changeBadge(metric('GROWTH', 0.3))).toEqual({ text: '+0,3', tone: 'growth' });
    expect(changeBadge(metric('DECLINE', -0.9))).toEqual({ text: '−0,9', tone: 'decline' });
    expect(changeBadge(metric('STABLE', 0))).toEqual({ text: '0,0 Стабильно', tone: 'stable' });
    expect(changeBadge(metric('INSUFFICIENT_DATA'))).toEqual({ text: 'Нет данных для сравнения', tone: 'neutral' });
  });

  it('tells «not graded» from «no grades this period»', () => {
    const none = { current: { state: 'NO_DATA' }, previous: { state: 'NO_DATA' } } as DynamicsMetric;
    expect(notGraded(none)).toBe(true);
    expect(emptyReason(none)).toBe('Оценки не выставляются');
    const gap = { current: { state: 'NO_DATA' }, previous: { state: 'AVAILABLE', value: 7 } } as DynamicsMetric;
    expect(notGraded(gap)).toBe(false);
    expect(emptyReason(gap)).toBe('Нет оценок за период');
  });

  it('labels the selected and the actual previous window', () => {
    expect(windowLabel({ type: 'QUARTER', academicPeriodName: '1 четверть', from: '2026-09-01', to: '2026-10-27' }))
      .toBe('1 четверть (01.09 – 27.10)');
    expect(compareLabel({ type: 'QUARTER', academicPeriodName: '4 четверти', academicYearName: '2025–2026' }))
      .toBe('к 4 четверти 2025–2026');
    expect(compareLabel({ type: 'WEEK', from: '2026-10-06', to: '2026-10-12' })).toMatch(/^к прошлой неделе \(6–12/);
    expect(compareLabel(null)).toBe('Прошлого периода нет');
  });

  it('keeps SOR and SOCH as they are and marks their kind', () => {
    expect(pointValue({ score: 23, maxScore: 25, gradeType: 'SUMMATIVE_SECTION' })).toEqual({ main: '23', max: '25' });
    expect(pointValue({ score: 8, maxScore: 10, gradeType: 'FORMATIVE' })).toEqual({ main: '8' });
    expect(pointValue({ scaleCode: '4+' })).toEqual({ main: '4+' });
    expect(pointKind({ gradeType: 'SUMMATIVE_TERM' })).toBe('SOCH');
    expect(pointKind({ component: 'SOR' })).toBe('SOR');
    expect(pointKind({ gradeType: 'ORAL_ANSWER' })).toBe('REGULAR');
  });

  it('sorts by the server change, rows without comparison last', () => {
    const rows = [
      { id: 1, m: metric('GROWTH', 0.3) },
      { id: 2, m: metric('INSUFFICIENT_DATA') },
      { id: 3, m: metric('DECLINE', -0.9) },
      { id: 4, m: metric('DECLINE', -0.4) },
    ];
    expect(sortByChange(rows, 'decline', (row) => row.m).map((row) => row.id)).toEqual([3, 4, 1, 2]);
    expect(sortByChange(rows, 'growth', (row) => row.m).map((row) => row.id)).toEqual([1, 4, 3, 2]);
    expect(sortByChange(rows, 'none', (row) => row.m).map((row) => row.id)).toEqual([1, 2, 3, 4]);
  });
});
