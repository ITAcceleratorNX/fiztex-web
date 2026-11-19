import { describe, expect, it } from 'vitest';
import type { GradebookColumn } from './gradebookApi';
import { columnCaption, summativeScoreLabel } from './journalModel';

describe('summativeScoreLabel', () => {
  it('drops the maximum that the work column header already shows', () => {
    expect(summativeScoreLabel(14, 20, 20)).toBe('14');
    expect(summativeScoreLabel(0, 20, 20)).toBe('0');
    expect(summativeScoreLabel(14, 25, 20)).toBe('14/25');
    expect(summativeScoreLabel(14, 20, null)).toBe('14/20');
    expect(summativeScoreLabel(null, 20, 20)).toBeNull();
  });
});

describe('columnCaption', () => {
  it('names an ordinary lesson by its number and a work by its title and maximum', () => {
    const lesson = { key: 'LESSON:1', type: 'LESSON', sourceId: 1, date: '2026-10-15', lessonNumber: 3 } as GradebookColumn;
    expect(columnCaption(lesson).event).toBe('Урок 3');
    const work = { key: 'ASSESSMENT_WORK:7', type: 'ASSESSMENT_WORK', sourceId: 7, lessonId: 1, date: '2026-10-15',
      title: 'СОР 1', assessmentKind: 'SOR', maxScore: 20 } as GradebookColumn;
    expect(columnCaption(work).event).toBe('СОР 1 / 20');
  });
});
