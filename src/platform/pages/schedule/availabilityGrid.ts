/**
 * Занятость учителя, разложенная по сетке «урок × день недели» (Figma 2015:10995).
 *
 * Строки сетки — периоды шаблона звонков, а не сами интервалы: макет нумерует
 * их как уроки. Состояние ячейки считается по тому же правилу, что и на бэкенде
 * (TeacherAvailabilityService): день ∈ workingDays, урок покрыт AVAILABLE
 * (или AVAILABLE на этот день нет вовсе) и не задет ни одним UNAVAILABLE.
 *
 * Урок занимает слот целиком, поэтому «Свободно» = свободен весь интервал
 * урока; частичное пересечение с недоступностью делает слот недоступным.
 */

import type { Weekday } from '@/lib/scheduleSettingsTypes';
import type { TeacherTimeType } from '@/lib/schedule2bTypes';
import {
  isFullyCoveredMinutes,
  mergeMinuteIntervals,
  nextIntervalKey,
  parseMinutes,
  toHhMm,
  type AvailabilityDraft,
  type IntervalDraft,
} from './availabilityValidation';

export type SlotState = 'FREE' | 'BLOCKED';

/** Строка сетки — период шаблона звонков. */
export type GridPeriod = {
  lessonNumber: number;
  /** HH:MM */
  startTime: string;
  /** HH:MM */
  endTime: string;
};

type MinuteRange = [number, number];

export function toGridPeriods(
  periods: Array<{ lessonNumber: number; startTime: string; endTime: string; sortOrder?: number }>,
): GridPeriod[] {
  return [...periods]
    .sort((a, b) => (a.sortOrder ?? a.lessonNumber) - (b.sortOrder ?? b.lessonNumber))
    .map((p) => ({
      lessonNumber: p.lessonNumber,
      startTime: toHhMm(p.startTime),
      endTime: toHhMm(p.endTime),
    }));
}

function rangeOf(period: GridPeriod): MinuteRange | null {
  const start = parseMinutes(period.startTime);
  const end = parseMinutes(period.endTime);
  if (start == null || end == null || start >= end) return null;
  return [start, end];
}

function dayRanges(
  intervals: IntervalDraft[],
  day: Weekday,
  type: TeacherTimeType,
): MinuteRange[] {
  const ranges: MinuteRange[] = [];
  for (const row of intervals) {
    if (row.dayOfWeek !== day || row.type !== type) continue;
    const start = parseMinutes(row.startTime);
    const end = parseMinutes(row.endTime);
    if (start == null || end == null || start >= end) continue;
    ranges.push([start, end]);
  }
  return mergeMinuteIntervals(ranges);
}

function overlaps(ranges: MinuteRange[], [start, end]: MinuteRange): boolean {
  return ranges.some(([from, to]) => from < end && start < to);
}

/** Вычитает [start,end) из набора диапазонов; интервал может распасться надвое. */
function subtractRange(ranges: MinuteRange[], [start, end]: MinuteRange): MinuteRange[] {
  const result: MinuteRange[] = [];
  for (const [from, to] of ranges) {
    if (to <= start || end <= from) {
      result.push([from, to]);
      continue;
    }
    if (from < start) result.push([from, start]);
    if (end < to) result.push([end, to]);
  }
  return result;
}

export function slotState(
  draft: AvailabilityDraft,
  day: Weekday,
  period: GridPeriod,
): SlotState {
  const range = rangeOf(period);
  if (range == null) return 'BLOCKED';
  if (!draft.workingDays.includes(day)) return 'BLOCKED';

  const available = dayRanges(draft.intervals, day, 'AVAILABLE');
  // Нет ни одного AVAILABLE на день — учитель доступен весь день (правило бэка).
  if (available.length > 0 && !isFullyCoveredMinutes(range[0], range[1], available)) {
    return 'BLOCKED';
  }
  if (overlaps(dayRanges(draft.intervals, day, 'UNAVAILABLE'), range)) return 'BLOCKED';
  return 'FREE';
}

function minutesToHhMm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toIntervalDrafts(
  day: Weekday,
  type: TeacherTimeType,
  ranges: MinuteRange[],
): IntervalDraft[] {
  return ranges.map(([start, end]) => ({
    key: nextIntervalKey(),
    dayOfWeek: day,
    startTime: minutesToHhMm(start),
    endTime: minutesToHhMm(end),
    type,
  }));
}

/**
 * Клик по ячейке. Правится только затронутый день; интервалы прочих дней
 * и их ключи не трогаются.
 *
 * Блокировка добавляет UNAVAILABLE на слот, освобождение — вырезает
 * недоступность и, если на дне заданы явные окна AVAILABLE, дотягивает
 * ближайшее до слота. Пересечения одного типа схлопываются, чтобы черновик
 * оставался валидным по правилам validateAvailabilityDraft.
 */
export function toggleSlot(
  draft: AvailabilityDraft,
  day: Weekday,
  period: GridPeriod,
): AvailabilityDraft {
  const range = rangeOf(period);
  if (range == null || !draft.workingDays.includes(day)) return draft;

  const available = dayRanges(draft.intervals, day, 'AVAILABLE');
  const unavailable = dayRanges(draft.intervals, day, 'UNAVAILABLE');

  let nextAvailable = available;
  let nextUnavailable = unavailable;

  if (slotState(draft, day, period) === 'FREE') {
    nextUnavailable = mergeMinuteIntervals([...unavailable, range]);
  } else {
    nextUnavailable = subtractRange(unavailable, range);
    if (available.length > 0 && !isFullyCoveredMinutes(range[0], range[1], available)) {
      nextAvailable = mergeMinuteIntervals([...available, range]);
    }
  }

  const untouched = draft.intervals.filter((row) => row.dayOfWeek !== day);
  return {
    ...draft,
    intervals: [
      ...untouched,
      ...toIntervalDrafts(day, 'AVAILABLE', nextAvailable),
      ...toIntervalDrafts(day, 'UNAVAILABLE', nextUnavailable),
    ],
  };
}

/**
 * Задаёт окно рабочих часов на все рабочие дни: AVAILABLE каждого рабочего дня
 * заменяется одним интервалом [start, end).
 *
 * Отдельного поля рабочих часов в API нет — окно выражается интервалами, и это
 * единственный способ его сузить: сетка правит только слоты уроков.
 * UNAVAILABLE остаются как есть: вырезанные окна переживают смену часов, а те,
 * что оказались за пределами нового окна, просто ни на что не влияют.
 */
export function setWorkingHours(
  draft: AvailabilityDraft,
  startTime: string,
  endTime: string,
): AvailabilityDraft {
  const start = parseMinutes(startTime);
  const end = parseMinutes(endTime);
  if (start == null || end == null || start >= end) return draft;

  const workingDays = new Set(draft.workingDays);
  const kept = draft.intervals.filter(
    (row) => row.type !== 'AVAILABLE' || !workingDays.has(row.dayOfWeek),
  );
  const windows = draft.workingDays.flatMap((day) =>
    toIntervalDrafts(day, 'AVAILABLE', [[start, end]]),
  );
  return { ...draft, intervals: [...kept, ...windows] };
}

/** Рабочие дни с разными окнами доступности — смена часов их выровняет. */
export function workingHoursDiffer(draft: AvailabilityDraft): boolean {
  const spans = draft.workingDays.map((day) => {
    const ranges = dayRanges(draft.intervals, day, 'AVAILABLE');
    if (ranges.length === 0) return 'all-day';
    return `${ranges[0]![0]}-${ranges[ranges.length - 1]![1]}`;
  });
  return new Set(spans).size > 1;
}

/**
 * «Рабочие часы: 08:00 – 16:00» из шапки карточки — размах окон AVAILABLE.
 * UNAVAILABLE сюда не входят: иначе правка часов «откатывалась» бы к вырезам
 * вне окна (см. setWorkingHours). Отдельного поля в API нет.
 */
export function workingHoursRange(draft: AvailabilityDraft): [string, string] | null {
  const bounds = draft.intervals
    .filter((row) => row.type === 'AVAILABLE')
    .map((row) => [parseMinutes(row.startTime), parseMinutes(row.endTime)] as const)
    .filter((pair): pair is readonly [number, number] => pair[0] != null && pair[1] != null);
  if (bounds.length === 0) return null;
  const start = Math.min(...bounds.map(([from]) => from));
  const end = Math.max(...bounds.map(([, to]) => to));
  return [minutesToHhMm(start), minutesToHhMm(end)];
}

export function workingHoursLabel(draft: AvailabilityDraft): string | null {
  const range = workingHoursRange(draft);
  return range ? `${range[0]} – ${range[1]}` : null;
}

/**
 * Интервалы, которые сетка шаблона звонков не отражает: они не пересекаются
 * ни с одним уроком. Широкое окно, которое лишь выходит за границы уроков,
 * сюда не попадает — его действие видно по самим ячейкам.
 */
export function offGridIntervals(
  draft: AvailabilityDraft,
  periods: GridPeriod[],
): IntervalDraft[] {
  const ranges = mergeMinuteIntervals(
    periods.map(rangeOf).filter((r): r is MinuteRange => r != null),
  );
  if (ranges.length === 0) return draft.intervals;
  return draft.intervals.filter((row) => {
    const start = parseMinutes(row.startTime);
    const end = parseMinutes(row.endTime);
    if (start == null || end == null || start >= end) return true;
    return !overlaps(ranges, [start, end]);
  });
}

/**
 * Дополняет строки шаблона звонков слотами под интервалы «вне сетки», чтобы
 * их было видно и можно было переключить кликом. Уроки шаблона сохраняют
 * номера; добавленные строки идут с продолжающейся нумерацией и сортируются
 * по времени начала.
 */
export function expandGridPeriods(
  periods: GridPeriod[],
  draft: AvailabilityDraft | null,
): GridPeriod[] {
  if (!draft || periods.length === 0) return periods;

  const hidden = offGridIntervals(draft, periods);
  if (hidden.length === 0) return periods;

  const coveredKeys = new Set(
    periods
      .map(rangeOf)
      .filter((r): r is MinuteRange => r != null)
      .map(([start, end]) => `${start}-${end}`),
  );

  let nextLesson =
    periods.reduce((max, period) => Math.max(max, period.lessonNumber), 0) + 1;
  const extras: GridPeriod[] = [];

  for (const row of hidden) {
    const start = parseMinutes(row.startTime);
    const end = parseMinutes(row.endTime);
    if (start == null || end == null || start >= end) continue;
    const key = `${start}-${end}`;
    if (coveredKeys.has(key)) continue;
    coveredKeys.add(key);
    extras.push({
      lessonNumber: nextLesson++,
      startTime: minutesToHhMm(start),
      endTime: minutesToHhMm(end),
    });
  }

  if (extras.length === 0) return periods;

  return [...periods, ...extras].sort((a, b) => {
    const aStart = parseMinutes(a.startTime) ?? 0;
    const bStart = parseMinutes(b.startTime) ?? 0;
    if (aStart !== bStart) return aStart - bStart;
    return a.lessonNumber - b.lessonNumber;
  });
}
