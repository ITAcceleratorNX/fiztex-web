import { describe, expect, it } from 'vitest';
import { formatDayMonthTime, formatShortDayMonth, formatShortDayMonthTime, pluralRu } from './format';

const SCORE: [string, string, string] = ['балл', 'балла', 'баллов'];

describe('pluralRu', () => {
  it.each([
    [1, 'балл'],
    [2, 'балла'],
    [4, 'балла'],
    [5, 'баллов'],
    [11, 'баллов'],
    [21, 'балл'],
    [22, 'балла'],
    [25, 'баллов'],
    [111, 'баллов'],
    [0, 'баллов'],
  ])('picks the right form for %i', (n, expected) => {
    expect(pluralRu(n, SCORE)).toBe(expected);
  });

  // Дробные всегда берут родительный единственного, независимо от последней цифры.
  it.each([0.5, 1.5, 2.5, 5.5, 1.3, 11.5])('uses the genitive singular for %f', (n) => {
    expect(pluralRu(n, SCORE)).toBe('балла');
  });
});

describe('даты реестра заявок', () => {
  const now = new Date(2026, 10, 5, 12, 0);
  const thisYear = new Date(2026, 10, 2, 15, 24).toISOString();
  const lastYear = new Date(2025, 9, 31, 9, 5).toISOString();

  it('не пишет текущий год', () => {
    expect(formatDayMonthTime(thisYear, now)).toBe('2 ноября, 15:24');
    expect(formatShortDayMonthTime(thisYear, now)).toBe('2 ноя., 15:24');
    expect(formatShortDayMonth(thisYear, now)).toBe('2 ноя.');
  });

  it('пишет прошлый год, чтобы даты разных лет не путались', () => {
    expect(formatDayMonthTime(lastYear, now)).toBe('31 октября 2025, 09:05');
    expect(formatShortDayMonthTime(lastYear, now)).toBe('31 окт. 2025, 09:05');
    expect(formatShortDayMonth(lastYear, now)).toBe('31 окт. 2025');
  });

  it('без даты — прочерк', () => {
    expect(formatDayMonthTime(null, now)).toBe('—');
    expect(formatShortDayMonth('не дата', now)).toBe('—');
  });
});
