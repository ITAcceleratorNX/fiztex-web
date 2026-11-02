import { describe, expect, it } from 'vitest';
import { overageParts, overageReason } from './ktpModel';

describe('KTP hours above the plan (UX-03)', () => {
  it('names plan, lessons by state and hours counted without a planned lesson, in backend numbers', () => {
    const overage = { plannedHours: 2, assignedHours: 3, conductedLessonHours: 1, upcomingLessonHours: 2, otherLessonHours: 0, extraHours: 0.5, excessHours: 1.5 };
    expect(overageParts(overage)).toEqual([
      'по плану 2 ч',
      'назначено на уроки 3 ч (проведено 1, впереди 2)',
      'учтено без урока по плану 0,5 ч',
    ]);
    expect(overageReason(overage)).toContain('учтена без урока по плану');
  });

  it('does not call manual progress a conducted lesson and explains cancelled reservations', () => {
    expect(overageParts({ plannedHours: 1, assignedHours: 2, upcomingLessonHours: 1, otherLessonHours: 1, excessHours: 1 }))
      .toEqual(['по плану 1 ч', 'назначено на уроки 2 ч (впереди 1, в отменённых или перенесённых 1)']);
    expect(overageReason({ otherLessonHours: 1 })).toContain('Отменённые');
    expect(overageReason({ assignedHours: 3, plannedHours: 2 })).toContain('больше уроков');
  });
});
