/**
 * Client-side mirror of TeacherAvailabilityValidator (В1–В5).
 * Cases synced with backend TeacherAvailabilityValidatorTest.
 */

import { isValidTime, normalizeTimeInput } from '@/components/ui/TimeInput';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import type { PreferredShift, TeacherTimeType } from '@/lib/schedule2bTypes';
import { WEEKDAYS_ORDER } from '@/platform/labels';

export type IntervalDraft = {
  key: string;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
  type: TeacherTimeType;
};

export type AvailabilityDraft = {
  workingDays: Weekday[];
  preferredShift: PreferredShift | null;
  intervals: IntervalDraft[];
  /** Server version for PUT; null when exists=false. */
  version: number | null;
};

export type IntervalRowError = {
  endBeforeStart?: boolean;
  outsideWorkingDay?: boolean;
  overlapSameType?: boolean;
  fullyBlocked?: boolean;
};

export type AvailabilityValidation = {
  byKey: Record<string, IntervalRowError>;
  /** Days that cannot be removed because they still have intervals. */
  dayChipErrors: Partial<Record<Weekday, string>>;
  hasErrors: boolean;
};

let draftSeq = 0;

export function nextIntervalKey(): string {
  draftSeq += 1;
  return `iv-${draftSeq}`;
}

export function toHhMm(time: string): string {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time.slice(0, 5);
  return `${match[1]!.padStart(2, '0')}:${match[2]}`;
}

export function parseMinutes(time: string): number | null {
  const normalized = normalizeTimeInput(time) ?? (isValidTime(time) ? time : null);
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map(Number);
  return h * 60 + m;
}

export function sortDays(days: Weekday[]): Weekday[] {
  return WEEKDAYS_ORDER.filter((d) => days.includes(d));
}

export function emptyAvailabilityDraft(): AvailabilityDraft {
  return {
    workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    preferredShift: null,
    intervals: [],
    version: null,
  };
}

export function availabilityToDraft(view: {
  workingDays: Weekday[];
  preferredShift: PreferredShift | null;
  version: number | null;
  intervals: Array<{
    dayOfWeek: Weekday;
    startTime: string;
    endTime: string;
    type: TeacherTimeType;
  }>;
}): AvailabilityDraft {
  return {
    workingDays: sortDays(view.workingDays),
    preferredShift: view.preferredShift,
    version: view.version,
    intervals: [...view.intervals]
      .map((i) => ({
        key: nextIntervalKey(),
        dayOfWeek: i.dayOfWeek,
        startTime: toHhMm(i.startTime),
        endTime: toHhMm(i.endTime),
        type: i.type,
      }))
      .sort(compareIntervals),
  };
}

export function compareIntervals(a: IntervalDraft, b: IntervalDraft): number {
  const dayA = WEEKDAYS_ORDER.indexOf(a.dayOfWeek);
  const dayB = WEEKDAYS_ORDER.indexOf(b.dayOfWeek);
  if (dayA !== dayB) return dayA - dayB;
  const sa = parseMinutes(a.startTime) ?? 0;
  const sb = parseMinutes(b.startTime) ?? 0;
  return sa - sb;
}

export function emptyIntervalDraft(day: Weekday = 'MONDAY'): IntervalDraft {
  return {
    key: nextIntervalKey(),
    dayOfWeek: day,
    startTime: '08:00',
    endTime: '14:00',
    type: 'AVAILABLE',
  };
}

export function sameDraft(a: AvailabilityDraft, b: AvailabilityDraft): boolean {
  if (a.preferredShift !== b.preferredShift) return false;
  if (a.workingDays.length !== b.workingDays.length) return false;
  if (a.workingDays.some((d, i) => d !== b.workingDays[i])) return false;
  if (a.intervals.length !== b.intervals.length) return false;
  const as = [...a.intervals].sort(compareIntervals);
  const bs = [...b.intervals].sort(compareIntervals);
  return as.every((row, i) => {
    const other = bs[i]!;
    return (
      row.dayOfWeek === other.dayOfWeek &&
      toHhMm(row.startTime) === toHhMm(other.startTime) &&
      toHhMm(row.endTime) === toHhMm(other.endTime) &&
      row.type === other.type
    );
  });
}

/**
 * Validate draft. When `proposedWorkingDays` is set, also check removal conflicts
 * (chip errors for days still referenced by intervals).
 */
export function validateAvailabilityDraft(
  draft: AvailabilityDraft,
  options?: { proposedWorkingDays?: Weekday[] },
): AvailabilityValidation {
  const byKey: Record<string, IntervalRowError> = {};
  const dayChipErrors: Partial<Record<Weekday, string>> = {};
  const ensure = (key: string): IntervalRowError => {
    if (!byKey[key]) byKey[key] = {};
    return byKey[key]!;
  };

  const workingDays = new Set(options?.proposedWorkingDays ?? draft.workingDays);

  if (options?.proposedWorkingDays) {
    const removed = draft.workingDays.filter((d) => !workingDays.has(d));
    for (const day of removed) {
      if (draft.intervals.some((i) => i.dayOfWeek === day)) {
        dayChipErrors[day] = 'Сначала удалите интервалы этого дня';
      }
    }
  }

  for (const row of draft.intervals) {
    const start = parseMinutes(row.startTime);
    const end = parseMinutes(row.endTime);
    if (start == null || end == null || !(start < end)) {
      ensure(row.key).endBeforeStart = true;
    }
    if (!workingDays.has(row.dayOfWeek)) {
      ensure(row.key).outsideWorkingDay = true;
    }
  }

  const byDay = new Map<Weekday, IntervalDraft[]>();
  for (const row of draft.intervals) {
    const list = byDay.get(row.dayOfWeek) ?? [];
    list.push(row);
    byDay.set(row.dayOfWeek, list);
  }

  for (const dayIntervals of byDay.values()) {
    markSameTypeOverlaps(dayIntervals, 'AVAILABLE', ensure);
    markSameTypeOverlaps(dayIntervals, 'UNAVAILABLE', ensure);
    markFullyBlocked(dayIntervals, ensure);
  }

  const hasErrors =
    Object.keys(dayChipErrors).length > 0 ||
    Object.values(byKey).some(
      (e) =>
        e.endBeforeStart ||
        e.outsideWorkingDay ||
        e.overlapSameType ||
        e.fullyBlocked,
    );

  return { byKey, dayChipErrors, hasErrors };
}

function markSameTypeOverlaps(
  dayIntervals: IntervalDraft[],
  type: TeacherTimeType,
  ensure: (key: string) => IntervalRowError,
) {
  const same = dayIntervals
    .filter((i) => i.type === type)
    .map((i) => ({ row: i, start: parseMinutes(i.startTime), end: parseMinutes(i.endTime) }))
    .filter((x) => x.start != null && x.end != null)
    .sort((a, b) => a.start! - b.start!);

  for (let i = 1; i < same.length; i++) {
    const prev = same[i - 1]!;
    const curr = same[i]!;
    if (prev.start! < curr.end! && curr.start! < prev.end!) {
      ensure(prev.row.key).overlapSameType = true;
      ensure(curr.row.key).overlapSameType = true;
    }
  }
}

function markFullyBlocked(
  dayIntervals: IntervalDraft[],
  ensure: (key: string) => IntervalRowError,
) {
  const available = dayIntervals.filter((i) => i.type === 'AVAILABLE');
  if (available.length === 0) return;

  const unavailable = dayIntervals
    .filter((i) => i.type === 'UNAVAILABLE')
    .map((i) => {
      const start = parseMinutes(i.startTime);
      const end = parseMinutes(i.endTime);
      return start != null && end != null ? ([start, end] as [number, number]) : null;
    })
    .filter((x): x is [number, number] => x != null);

  const merged = mergeMinuteIntervals(unavailable);

  for (const avail of available) {
    const start = parseMinutes(avail.startTime);
    const end = parseMinutes(avail.endTime);
    if (start == null || end == null) continue;
    if (isFullyCoveredMinutes(start, end, merged)) {
      ensure(avail.key).fullyBlocked = true;
    }
  }
}

/** Merge overlapping/adjacent [start,end) minute ranges. */
export function mergeMinuteIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  let current: [number, number] = [sorted[0]![0], sorted[0]![1]];
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;
    if (next[0] <= current[1]) {
      current[1] = Math.max(current[1], next[1]);
    } else {
      merged.push(current);
      current = [next[0], next[1]];
    }
  }
  merged.push(current);
  return merged;
}

export function isFullyCoveredMinutes(
  start: number,
  end: number,
  merged: Array<[number, number]>,
): boolean {
  let cursor = start;
  for (const [b0, b1] of merged) {
    if (b1 <= cursor) continue;
    if (b0 > cursor) return false;
    cursor = Math.max(cursor, b1);
    if (cursor >= end) return true;
  }
  return cursor >= end;
}

export function draftToPutBody(draft: AvailabilityDraft) {
  return {
    workingDays: sortDays(draft.workingDays),
    preferredShift: draft.preferredShift,
    intervals: draft.intervals.map((i) => ({
      dayOfWeek: i.dayOfWeek,
      startTime: normalizeTimeInput(i.startTime) ?? i.startTime,
      endTime: normalizeTimeInput(i.endTime) ?? i.endTime,
      type: i.type,
    })),
    version: draft.version,
  };
}

export function rowErrorMessage(error: IntervalRowError | undefined): string | null {
  if (!error) return null;
  if (error.endBeforeStart) return 'Время окончания должно быть позже начала';
  if (error.outsideWorkingDay) return 'День интервала не входит в рабочие дни';
  if (error.overlapSameType) return 'Пересечение с другим интервалом того же типа';
  if (error.fullyBlocked) return 'AVAILABLE полностью перекрыт недоступностью';
  return null;
}
