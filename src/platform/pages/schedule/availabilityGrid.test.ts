import { describe, expect, it } from 'vitest';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import type { TeacherTimeType } from '@/lib/schedule2bTypes';
import {
  nextIntervalKey,
  validateAvailabilityDraft,
  type AvailabilityDraft,
  type IntervalDraft,
} from './availabilityValidation';
import {
  expandGridPeriods,
  offGridIntervals,
  setWorkingHours,
  slotState,
  toGridPeriods,
  toggleSlot,
  workingHoursDiffer,
  workingHoursLabel,
  type GridPeriod,
} from './availabilityGrid';

const MON: Weekday = 'MONDAY';
const TUE: Weekday = 'TUESDAY';

const LESSON_1: GridPeriod = { lessonNumber: 1, startTime: '08:00', endTime: '10:00' };
const LESSON_2: GridPeriod = { lessonNumber: 2, startTime: '10:00', endTime: '11:00' };
const LESSON_3: GridPeriod = { lessonNumber: 3, startTime: '11:00', endTime: '13:00' };
const PERIODS = [LESSON_1, LESSON_2, LESSON_3];

function interval(
  day: Weekday,
  startTime: string,
  endTime: string,
  type: TeacherTimeType,
): IntervalDraft {
  return { key: nextIntervalKey(), dayOfWeek: day, startTime, endTime, type };
}

function draft(intervals: IntervalDraft[], workingDays: Weekday[] = [MON, TUE]): AvailabilityDraft {
  return { workingDays, preferredShift: null, intervals, version: 1 };
}

function dayIntervals(next: AvailabilityDraft, day: Weekday, type: TeacherTimeType) {
  return next.intervals
    .filter((row) => row.dayOfWeek === day && row.type === type)
    .map((row) => `${row.startTime}-${row.endTime}`)
    .sort();
}

describe('slotState', () => {
  it('день без интервалов свободен целиком', () => {
    expect(slotState(draft([]), MON, LESSON_1)).toBe('FREE');
  });

  it('нерабочий день заблокирован, даже если интервалы есть', () => {
    const state = draft([interval(MON, '08:00', '16:00', 'AVAILABLE')], [TUE]);
    expect(slotState(state, MON, LESSON_1)).toBe('BLOCKED');
  });

  it('AVAILABLE сужает день: урок вне окна заблокирован', () => {
    const state = draft([interval(MON, '08:00', '10:00', 'AVAILABLE')]);
    expect(slotState(state, MON, LESSON_1)).toBe('FREE');
    expect(slotState(state, MON, LESSON_2)).toBe('BLOCKED');
  });

  it('урок, покрытый окном лишь частично, недоступен целиком', () => {
    const state = draft([interval(MON, '08:00', '09:00', 'AVAILABLE')]);
    expect(slotState(state, MON, LESSON_1)).toBe('BLOCKED');
  });

  it('соседние AVAILABLE-окна вместе покрывают урок', () => {
    const state = draft([
      interval(MON, '08:00', '09:00', 'AVAILABLE'),
      interval(MON, '09:00', '10:00', 'AVAILABLE'),
    ]);
    expect(slotState(state, MON, LESSON_1)).toBe('FREE');
  });

  it('любое пересечение с UNAVAILABLE блокирует весь урок', () => {
    const state = draft([interval(MON, '09:30', '09:45', 'UNAVAILABLE')]);
    expect(slotState(state, MON, LESSON_1)).toBe('BLOCKED');
    expect(slotState(state, MON, LESSON_2)).toBe('FREE');
  });

  it('UNAVAILABLE, примыкающий встык, урок не трогает', () => {
    const state = draft([interval(MON, '10:00', '11:00', 'UNAVAILABLE')]);
    expect(slotState(state, MON, LESSON_1)).toBe('FREE');
    expect(slotState(state, MON, LESSON_2)).toBe('BLOCKED');
  });

  it('интервалы соседнего дня на день не влияют', () => {
    const state = draft([interval(TUE, '08:00', '16:00', 'UNAVAILABLE')]);
    expect(slotState(state, MON, LESSON_1)).toBe('FREE');
  });
});

describe('toggleSlot', () => {
  it('свободный слот на пустом дне становится UNAVAILABLE', () => {
    const next = toggleSlot(draft([]), MON, LESSON_2);
    expect(slotState(next, MON, LESSON_2)).toBe('BLOCKED');
    expect(slotState(next, MON, LESSON_1)).toBe('FREE');
    expect(dayIntervals(next, MON, 'UNAVAILABLE')).toEqual(['10:00-11:00']);
  });

  it('повторный клик возвращает слот в исходное состояние', () => {
    const start = draft([]);
    const there = toggleSlot(start, MON, LESSON_2);
    const back = toggleSlot(there, MON, LESSON_2);
    expect(slotState(back, MON, LESSON_2)).toBe('FREE');
    expect(back.intervals).toHaveLength(0);
  });

  it('соседние блокировки схлопываются в один интервал', () => {
    let next = toggleSlot(draft([]), MON, LESSON_1);
    next = toggleSlot(next, MON, LESSON_2);
    expect(dayIntervals(next, MON, 'UNAVAILABLE')).toEqual(['08:00-11:00']);
  });

  it('снятие блокировки в середине разрезает интервал надвое', () => {
    const state = draft([interval(MON, '08:00', '13:00', 'UNAVAILABLE')]);
    const next = toggleSlot(state, MON, LESSON_2);
    expect(dayIntervals(next, MON, 'UNAVAILABLE')).toEqual(['08:00-10:00', '11:00-13:00']);
    expect(slotState(next, MON, LESSON_2)).toBe('FREE');
  });

  it('на дне с явными окнами освобождение расширяет AVAILABLE, а не режет недоступность', () => {
    const state = draft([interval(MON, '08:00', '10:00', 'AVAILABLE')]);
    const next = toggleSlot(state, MON, LESSON_2);
    expect(dayIntervals(next, MON, 'AVAILABLE')).toEqual(['08:00-11:00']);
    expect(slotState(next, MON, LESSON_2)).toBe('FREE');
  });

  it('блокировка внутри окна режет доступность, а не всё окно', () => {
    const state = draft([interval(MON, '08:00', '13:00', 'AVAILABLE')]);
    const next = toggleSlot(state, MON, LESSON_2);
    expect(slotState(next, MON, LESSON_1)).toBe('FREE');
    expect(slotState(next, MON, LESSON_2)).toBe('BLOCKED');
    expect(slotState(next, MON, LESSON_3)).toBe('FREE');
  });

  it('переключение не трогает интервалы других дней', () => {
    const other = interval(TUE, '08:00', '10:00', 'UNAVAILABLE');
    const next = toggleSlot(draft([other]), MON, LESSON_1);
    const kept = next.intervals.find((row) => row.dayOfWeek === TUE);
    expect(kept).toEqual(other);
  });

  it('нерабочий день не переключается', () => {
    const state = draft([], [TUE]);
    expect(toggleSlot(state, MON, LESSON_1)).toBe(state);
  });

  it('результат переключений остаётся валидным черновиком', () => {
    let next = draft([interval(MON, '08:00', '13:00', 'AVAILABLE')]);
    next = toggleSlot(next, MON, LESSON_2);
    next = toggleSlot(next, MON, LESSON_1);
    next = toggleSlot(next, MON, LESSON_1);
    expect(validateAvailabilityDraft(next).hasErrors).toBe(false);
  });
});

describe('setWorkingHours', () => {
  it('ставит одно окно на каждый рабочий день', () => {
    const next = setWorkingHours(draft([]), '08:00', '16:00');
    expect(dayIntervals(next, MON, 'AVAILABLE')).toEqual(['08:00-16:00']);
    expect(dayIntervals(next, TUE, 'AVAILABLE')).toEqual(['08:00-16:00']);
    expect(workingHoursLabel(next)).toBe('08:00 – 16:00');
  });

  it('заменяет прежние окна, а не добавляется к ним', () => {
    const state = draft([
      interval(MON, '08:00', '14:00', 'AVAILABLE'),
      interval(MON, '15:00', '18:00', 'AVAILABLE'),
    ]);
    const next = setWorkingHours(state, '09:00', '13:00');
    expect(dayIntervals(next, MON, 'AVAILABLE')).toEqual(['09:00-13:00']);
  });

  it('сужение окна закрывает уроки, оказавшиеся снаружи', () => {
    const state = setWorkingHours(draft([]), '08:00', '16:00');
    expect(slotState(state, MON, LESSON_3)).toBe('FREE');
    const narrowed = setWorkingHours(state, '08:00', '10:00');
    expect(slotState(narrowed, MON, LESSON_1)).toBe('FREE');
    expect(slotState(narrowed, MON, LESSON_3)).toBe('BLOCKED');
  });

  it('вырезанные окна переживают смену часов', () => {
    const state = draft([interval(MON, '10:00', '11:00', 'UNAVAILABLE')]);
    const next = setWorkingHours(state, '08:00', '16:00');
    expect(dayIntervals(next, MON, 'UNAVAILABLE')).toEqual(['10:00-11:00']);
    expect(slotState(next, MON, LESSON_2)).toBe('BLOCKED');
  });

  it('нерабочие дни не трогает', () => {
    const other = interval(TUE, '08:00', '12:00', 'AVAILABLE');
    const next = setWorkingHours(draft([other], [MON]), '09:00', '15:00');
    expect(next.intervals.find((row) => row.dayOfWeek === TUE)).toEqual(other);
  });

  it('некорректный диапазон черновик не меняет', () => {
    const state = draft([interval(MON, '08:00', '14:00', 'AVAILABLE')]);
    expect(setWorkingHours(state, '14:00', '08:00')).toBe(state);
    expect(setWorkingHours(state, '08:0', '')).toBe(state);
  });

  it('результат остаётся валидным черновиком', () => {
    const next = setWorkingHours(draft([]), '08:00', '16:00');
    expect(validateAvailabilityDraft(next).hasErrors).toBe(false);
  });
});

describe('workingHoursDiffer', () => {
  it('одинаковые окна — расхождения нет', () => {
    const state = draft([
      interval(MON, '08:00', '14:00', 'AVAILABLE'),
      interval(TUE, '08:00', '14:00', 'AVAILABLE'),
    ]);
    expect(workingHoursDiffer(state)).toBe(false);
  });

  it('разные окна по дням — расхождение есть', () => {
    const state = draft([
      interval(MON, '08:00', '14:00', 'AVAILABLE'),
      interval(TUE, '08:00', '15:00', 'AVAILABLE'),
    ]);
    expect(workingHoursDiffer(state)).toBe(true);
  });

  it('день без окон (свободен весь день) отличается от дня с окном', () => {
    const state = draft([interval(MON, '08:00', '14:00', 'AVAILABLE')]);
    expect(workingHoursDiffer(state)).toBe(true);
  });

  it('пустой черновик — все дни одинаково свободны', () => {
    expect(workingHoursDiffer(draft([]))).toBe(false);
  });
});

describe('workingHoursLabel', () => {
  it('размах по всем интервалам дня и недели', () => {
    const state = draft([
      interval(MON, '08:00', '10:00', 'AVAILABLE'),
      interval(TUE, '12:00', '16:00', 'AVAILABLE'),
    ]);
    expect(workingHoursLabel(state)).toBe('08:00 – 16:00');
  });

  it('UNAVAILABLE не растягивает рабочие часы', () => {
    const state = draft([
      interval(MON, '08:00', '14:00', 'AVAILABLE'),
      interval(MON, '15:00', '16:00', 'UNAVAILABLE'),
    ]);
    expect(workingHoursLabel(state)).toBe('08:00 – 14:00');
  });

  it('без интервалов часов нет', () => {
    expect(workingHoursLabel(draft([]))).toBeNull();
  });

  it('только UNAVAILABLE — часов нет', () => {
    expect(workingHoursLabel(draft([interval(MON, '15:00', '16:00', 'UNAVAILABLE')]))).toBeNull();
  });
});

describe('offGridIntervals', () => {
  it('интервал по границам уроков сеткой показан', () => {
    const state = draft([interval(MON, '08:00', '11:00', 'UNAVAILABLE')]);
    expect(offGridIntervals(state, PERIODS)).toEqual([]);
  });

  it('окно шире уроков не считается невидимым — его действие видно по ячейкам', () => {
    const state = draft([interval(MON, '07:00', '15:00', 'AVAILABLE')]);
    expect(offGridIntervals(state, PERIODS)).toEqual([]);
  });

  it('интервал без единого пересечения с уроками возвращается как невидимый', () => {
    const hidden = interval(MON, '06:00', '08:00', 'UNAVAILABLE');
    const state = draft([hidden, interval(MON, '10:00', '11:00', 'UNAVAILABLE')]);
    expect(offGridIntervals(state, PERIODS)).toEqual([hidden]);
  });

  it('без периодов невидимо всё', () => {
    const state = draft([interval(MON, '08:00', '10:00', 'AVAILABLE')]);
    expect(offGridIntervals(state, [])).toHaveLength(1);
  });
});

describe('expandGridPeriods', () => {
  it('без черновика или без скрытых интервалов возвращает шаблон как есть', () => {
    expect(expandGridPeriods(PERIODS, null)).toEqual(PERIODS);
    expect(expandGridPeriods(PERIODS, draft([interval(MON, '08:00', '11:00', 'AVAILABLE')]))).toEqual(
      PERIODS,
    );
  });

  it('добавляет строку для интервала вне уроков и сортирует по времени', () => {
    const state = draft([interval(MON, '15:00', '16:00', 'UNAVAILABLE')]);
    const expanded = expandGridPeriods(PERIODS, state);
    expect(expanded).toEqual([
      ...PERIODS,
      { lessonNumber: 4, startTime: '15:00', endTime: '16:00' },
    ]);
  });

  it('после расширения интервал больше не считается вне сетки', () => {
    const state = draft([interval(MON, '06:00', '07:00', 'AVAILABLE')]);
    const expanded = expandGridPeriods(PERIODS, state);
    expect(offGridIntervals(state, expanded)).toEqual([]);
    expect(slotState(state, MON, expanded[0]!)).toBe('FREE');
  });

  it('одинаковые скрытые диапазоны не дублирует', () => {
    const state = draft([
      interval(MON, '15:00', '16:00', 'UNAVAILABLE'),
      interval(TUE, '15:00', '16:00', 'AVAILABLE'),
    ]);
    const extras = expandGridPeriods(PERIODS, state).filter((p) => p.startTime === '15:00');
    expect(extras).toHaveLength(1);
  });
});

describe('toGridPeriods', () => {
  it('режет секунды и сортирует по sortOrder', () => {
    expect(
      toGridPeriods([
        { lessonNumber: 2, startTime: '10:00:00', endTime: '11:00:00', sortOrder: 2 },
        { lessonNumber: 1, startTime: '08:00:00', endTime: '10:00:00', sortOrder: 1 },
      ]),
    ).toEqual([LESSON_1, LESSON_2]);
  });
});
