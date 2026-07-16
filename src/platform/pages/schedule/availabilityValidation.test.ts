/**
 * Mirrors TeacherAvailabilityValidatorTest (fiztex-back) — keep cases in sync.
 */
import { describe, expect, it } from 'vitest';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import {
  emptyIntervalDraft,
  nextIntervalKey,
  validateAvailabilityDraft,
  type AvailabilityDraft,
  type IntervalDraft,
} from './availabilityValidation';

function interval(
  day: Weekday,
  start: string,
  end: string,
  type: 'AVAILABLE' | 'UNAVAILABLE',
): IntervalDraft {
  return { key: nextIntervalKey(), dayOfWeek: day, startTime: start, endTime: end, type };
}

function draft(partial: Partial<AvailabilityDraft> & { intervals: IntervalDraft[] }): AvailabilityDraft {
  return {
    workingDays: partial.workingDays ?? [
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ],
    preferredShift: partial.preferredShift ?? null,
    version: partial.version ?? null,
    intervals: partial.intervals,
  };
}

describe('validateAvailabilityDraft (mirror backend Validator)', () => {
  it('availableOverlap → overlapSameType', () => {
    const result = validateAvailabilityDraft(
      draft({
        intervals: [
          interval('MONDAY', '09:00', '12:00', 'AVAILABLE'),
          interval('MONDAY', '11:00', '14:00', 'AVAILABLE'),
        ],
      }),
    );
    expect(result.hasErrors).toBe(true);
    expect(Object.values(result.byKey).some((e) => e.overlapSameType)).toBe(true);
  });

  it('unavailableOverlap → overlapSameType', () => {
    const result = validateAvailabilityDraft(
      draft({
        intervals: [
          interval('MONDAY', '09:00', '12:00', 'UNAVAILABLE'),
          interval('MONDAY', '11:00', '14:00', 'UNAVAILABLE'),
        ],
      }),
    );
    expect(result.hasErrors).toBe(true);
    expect(Object.values(result.byKey).some((e) => e.overlapSameType)).toBe(true);
  });

  it('unavailableInsideAvailable → ok', () => {
    const result = validateAvailabilityDraft(
      draft({
        intervals: [
          interval('MONDAY', '08:00', '14:00', 'AVAILABLE'),
          interval('MONDAY', '12:00', '13:00', 'UNAVAILABLE'),
        ],
      }),
    );
    expect(result.hasErrors).toBe(false);
  });

  it('twoUnavailableFullyCoveringAvailable → fullyBlocked', () => {
    const result = validateAvailabilityDraft(
      draft({
        intervals: [
          interval('MONDAY', '08:00', '14:00', 'AVAILABLE'),
          interval('MONDAY', '08:00', '11:00', 'UNAVAILABLE'),
          interval('MONDAY', '11:00', '14:00', 'UNAVAILABLE'),
        ],
      }),
    );
    expect(result.hasErrors).toBe(true);
    expect(Object.values(result.byKey).some((e) => e.fullyBlocked)).toBe(true);
  });

  it('adjacentSameType → ok', () => {
    const result = validateAvailabilityDraft(
      draft({
        intervals: [
          interval('MONDAY', '09:00', '12:00', 'AVAILABLE'),
          interval('MONDAY', '12:00', '18:00', 'AVAILABLE'),
        ],
      }),
    );
    expect(result.hasErrors).toBe(false);
  });

  it('dayOutsideWorkingDays → outsideWorkingDay', () => {
    const result = validateAvailabilityDraft(
      draft({
        workingDays: ['MONDAY', 'FRIDAY'],
        intervals: [interval('SUNDAY', '09:00', '12:00', 'AVAILABLE')],
      }),
    );
    expect(result.hasErrors).toBe(true);
    expect(Object.values(result.byKey).some((e) => e.outsideWorkingDay)).toBe(true);
  });

  it('endBeforeStart → endBeforeStart', () => {
    const result = validateAvailabilityDraft(
      draft({ intervals: [interval('MONDAY', '12:00', '09:00', 'AVAILABLE')] }),
    );
    expect(result.hasErrors).toBe(true);
    expect(Object.values(result.byKey).some((e) => e.endBeforeStart)).toBe(true);
  });

  it('endEqualsStart → endBeforeStart', () => {
    const result = validateAvailabilityDraft(
      draft({ intervals: [interval('MONDAY', '12:00', '12:00', 'AVAILABLE')] }),
    );
    expect(result.hasErrors).toBe(true);
    expect(Object.values(result.byKey).some((e) => e.endBeforeStart)).toBe(true);
  });

  it('removing day with intervals → dayChipErrors', () => {
    const current = draft({
      workingDays: ['MONDAY', 'TUESDAY'],
      intervals: [interval('MONDAY', '09:00', '12:00', 'AVAILABLE')],
    });
    const result = validateAvailabilityDraft(current, {
      proposedWorkingDays: ['TUESDAY'],
    });
    expect(result.dayChipErrors.MONDAY).toBeTruthy();
    expect(result.hasErrors).toBe(true);
  });

  it('emptyIntervalDraft has stable shape', () => {
    const row = emptyIntervalDraft('WEDNESDAY');
    expect(row.dayOfWeek).toBe('WEDNESDAY');
    expect(row.type).toBe('AVAILABLE');
  });
});
