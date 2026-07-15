import type { LessonPeriod } from '@/lib/scheduleSettingsTypes';
import { isValidTime, normalizeTimeInput } from '@/components/ui/TimeInput';

export type PeriodDraft = {
  /** Stable client key for React lists (new rows before save). */
  key: string;
  /** Server id when editing an existing period. */
  id?: number;
  lessonNumber: number;
  startTime: string;
  endTime: string;
};

export type PeriodRowError = {
  endBeforeStart?: boolean;
  duplicateNumber?: boolean;
  overlapWithKeys?: string[];
};

export type PeriodValidation = {
  byKey: Record<string, PeriodRowError>;
  hasErrors: boolean;
};

let draftSeq = 0;

export function nextDraftKey(): string {
  draftSeq += 1;
  return `draft-${draftSeq}`;
}

/** Strip seconds from backend LocalTime ("08:00:00" → "08:00"). */
export function toHhMm(time: string): string {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time.slice(0, 5);
  return `${match[1]!.padStart(2, '0')}:${match[2]}`;
}

export function periodsToDraft(periods: LessonPeriod[]): PeriodDraft[] {
  return [...periods]
    .sort((a, b) => a.lessonNumber - b.lessonNumber || a.sortOrder - b.sortOrder)
    .map((p) => ({
      key: `period-${p.id}`,
      id: p.id,
      lessonNumber: p.lessonNumber,
      startTime: toHhMm(p.startTime),
      endTime: toHhMm(p.endTime),
    }));
}

export function emptyPeriodDraft(after?: PeriodDraft): PeriodDraft {
  const lessonNumber = after ? after.lessonNumber + 1 : 1;
  if (!after) {
    return { key: nextDraftKey(), lessonNumber, startTime: '08:00', endTime: '08:45' };
  }
  const duration = Math.max(5, minutesBetween(after.startTime, after.endTime) ?? 45);
  const startTime = addMinutes(after.endTime, 10) ?? '09:00';
  const endTime = addMinutes(startTime, duration) ?? '09:45';
  return { key: nextDraftKey(), lessonNumber, startTime, endTime };
}

export function parseMinutes(time: string): number | null {
  const normalized = normalizeTimeInput(time) ?? (isValidTime(time) ? time : null);
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map(Number);
  return h * 60 + m;
}

export function minutesBetween(start: string, end: string): number | null {
  const a = parseMinutes(start);
  const b = parseMinutes(end);
  if (a == null || b == null) return null;
  return b - a;
}

export function addMinutes(time: string, delta: number): string | null {
  const base = parseMinutes(time);
  if (base == null) return null;
  const total = ((base + delta) % (24 * 60) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Client validation aligned with LessonPeriodService:
 * - start must be strictly before end
 * - overlap uses half-open windows; end == next.start is OK
 */
export function validatePeriodDrafts(rows: PeriodDraft[]): PeriodValidation {
  const byKey: Record<string, PeriodRowError> = {};
  const ensure = (key: string): PeriodRowError => {
    if (!byKey[key]) byKey[key] = {};
    return byKey[key]!;
  };

  const numberCounts = new Map<number, string[]>();
  for (const row of rows) {
    const list = numberCounts.get(row.lessonNumber) ?? [];
    list.push(row.key);
    numberCounts.set(row.lessonNumber, list);

    const start = parseMinutes(row.startTime);
    const end = parseMinutes(row.endTime);
    if (start == null || end == null || !(start < end)) {
      ensure(row.key).endBeforeStart = true;
    }
  }

  for (const keys of numberCounts.values()) {
    if (keys.length > 1) {
      for (const key of keys) ensure(key).duplicateNumber = true;
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]!;
    const aStart = parseMinutes(a.startTime);
    const aEnd = parseMinutes(a.endTime);
    if (aStart == null || aEnd == null) continue;
    for (let j = i + 1; j < rows.length; j++) {
      const b = rows[j]!;
      const bStart = parseMinutes(b.startTime);
      const bEnd = parseMinutes(b.endTime);
      if (bStart == null || bEnd == null) continue;
      // Same half-open check as backend: start < other.end && other.start < end
      if (aStart < bEnd && bStart < aEnd) {
        const ae = ensure(a.key);
        const be = ensure(b.key);
        ae.overlapWithKeys = [...(ae.overlapWithKeys ?? []), b.key];
        be.overlapWithKeys = [...(be.overlapWithKeys ?? []), a.key];
      }
    }
  }

  const hasErrors = Object.values(byKey).some(
    (e) => e.endBeforeStart || e.duplicateNumber || (e.overlapWithKeys?.length ?? 0) > 0,
  );
  return { byKey, hasErrors };
}

/** Break after row i toward next by lessonNumber (sorted). Negative = overlap. */
export function breakAfterMinutes(rows: PeriodDraft[], index: number): number | null {
  const sorted = [...rows].sort((a, b) => a.lessonNumber - b.lessonNumber);
  const current = sorted[index];
  const next = sorted[index + 1];
  if (!current || !next) return null;
  return minutesBetween(current.endTime, next.startTime);
}

export type PeriodDiff = {
  toDelete: number[];
  toUpdate: Array<{ periodId: number; lessonNumber: number; startTime: string; endTime: string; sortOrder: number }>;
  toAdd: Array<{ lessonNumber: number; startTime: string; endTime: string; sortOrder: number }>;
};

export function diffPeriods(original: LessonPeriod[], draft: PeriodDraft[]): PeriodDiff {
  const originalById = new Map(original.map((p) => [p.id, p]));
  const keptIds = new Set(draft.filter((d) => d.id != null).map((d) => d.id!));

  const toDelete = original.filter((p) => !keptIds.has(p.id)).map((p) => p.id);
  const toUpdate: PeriodDiff['toUpdate'] = [];
  const toAdd: PeriodDiff['toAdd'] = [];

  for (const row of draft) {
    const startTime = normalizeTimeInput(row.startTime) ?? row.startTime;
    const endTime = normalizeTimeInput(row.endTime) ?? row.endTime;
    const sortOrder = row.lessonNumber;
    if (row.id == null) {
      toAdd.push({ lessonNumber: row.lessonNumber, startTime, endTime, sortOrder });
      continue;
    }
    const prev = originalById.get(row.id);
    if (!prev) {
      toAdd.push({ lessonNumber: row.lessonNumber, startTime, endTime, sortOrder });
      continue;
    }
    const same =
      prev.lessonNumber === row.lessonNumber &&
      toHhMm(prev.startTime) === startTime &&
      toHhMm(prev.endTime) === endTime;
    if (!same) {
      toUpdate.push({
        periodId: row.id,
        lessonNumber: row.lessonNumber,
        startTime,
        endTime,
        sortOrder,
      });
    }
  }

  return { toDelete, toUpdate, toAdd };
}
