import { describe, expect, it } from 'vitest';
import {
  isValidIsoDate,
  mergeSearchParams,
  parseOneBasedPage,
  parsePositiveInteger,
} from './listNavigation';

describe('URL state for lists', () => {
  it('merges and removes parameters without dropping unrelated context', () => {
    const current = new URLSearchParams('tab=all&page=3&q=door&status=NEW');
    const next = mergeSearchParams(current, { page: null, q: 'hall', status: '' });
    expect(next.toString()).toBe('tab=all&q=hall');
  });

  it('accepts only safe positive integer identifiers and one-based pages', () => {
    expect(parsePositiveInteger('21')).toBe(21);
    expect(parsePositiveInteger('0')).toBeNull();
    expect(parsePositiveInteger('1.2')).toBeNull();
    expect(parseOneBasedPage('3')).toBe(2);
    expect(parseOneBasedPage('0')).toBe(0);
    expect(parseOneBasedPage('9007199254740992')).toBe(0);
  });

  it('validates real calendar dates, not just ISO-shaped strings', () => {
    expect(isValidIsoDate('2026-09-28')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('28.09.2026')).toBe(false);
    expect(isValidIsoDate(null)).toBe(false);
  });
});
