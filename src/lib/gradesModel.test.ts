import { describe, expect, it } from 'vitest';
import { gradeValueLabel, isKeptScaleGrade } from './gradesModel';

describe('isKeptScaleGrade (QA-06)', () => {
  it('marks a 2–5 grade left in a period that now counts points', () => {
    expect(isKeptScaleGrade('POINTS', { scaleCode: '4+' })).toBe(true);
    expect(gradeValueLabel({ scaleCode: '4+' })).toBe('4+');
  });

  it('does not touch points grades or periods still on the scale', () => {
    expect(isKeptScaleGrade('POINTS', { score: 8, maxScore: 10 })).toBe(false);
    expect(isKeptScaleGrade('SCALE', { scaleCode: '4' })).toBe(false);
    expect(isKeptScaleGrade(undefined, { scaleCode: '4' })).toBe(false);
    expect(isKeptScaleGrade('POINTS', null)).toBe(false);
  });
});
