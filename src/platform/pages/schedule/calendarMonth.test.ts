import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '@/lib/scheduleSettingsTypes';
import {
  buildMonthGrid,
  formatEventDates,
  monthGridRange,
  monthOf,
  monthTitle,
  shiftMonth,
} from './calendarMonth';

function event(dateFrom: string, dateTo: string, title = 'Событие'): CalendarEvent {
  return {
    id: Math.random(),
    academicYearId: 1,
    dateFrom,
    dateTo,
    type: 'VACATION',
    title,
    effect: 'NO_LESSONS',
    scope: 'SCHOOL',
    status: 'ACTIVE',
    targets: [],
    createdBy: 1,
    updatedBy: null,
    createdAt: '',
    updatedAt: '',
  };
}

const OCT_2026 = { year: 2026, month: 10 };

describe('monthGridRange', () => {
  it('тянется от понедельника первой недели до воскресенья последней', () => {
    // 1 октября 2026 — четверг, 31 октября — суббота.
    expect(monthGridRange(OCT_2026)).toEqual({ from: '2026-09-28', to: '2026-11-01' });
  });

  it('месяц, начинающийся с понедельника, не добавляет неделю слева', () => {
    // 1 июня 2026 — понедельник.
    expect(monthGridRange({ year: 2026, month: 6 }).from).toBe('2026-06-01');
  });

  it('февраль високосного года заканчивается 29-м', () => {
    expect(monthGridRange({ year: 2028, month: 2 }).to).toBe('2028-03-05');
  });
});

describe('buildMonthGrid', () => {
  it('ровные недели по 7 дней, первый — понедельник', () => {
    const weeks = buildMonthGrid(OCT_2026, []);
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]![0]!.date).toBe('2026-09-28');
    expect(weeks.at(-1)!.at(-1)!.date).toBe('2026-11-01');
  });

  it('дни соседних месяцев помечены outside', () => {
    const weeks = buildMonthGrid(OCT_2026, []);
    expect(weeks[0]![0]).toMatchObject({ dayOfMonth: 28, outside: true });
    expect(weeks[0]![3]).toMatchObject({ dayOfMonth: 1, outside: false });
    expect(weeks.at(-1)!.at(-1)).toMatchObject({ dayOfMonth: 1, outside: true });
  });

  it('событие-период попадает в каждый свой день, включая хвост в соседнем месяце', () => {
    const vacation = event('2026-10-28', '2026-11-05', 'Осенние каникулы');
    const weeks = buildMonthGrid(OCT_2026, [vacation]);
    const cells = weeks.flat();
    const withEvent = cells.filter((c) => c.events.length > 0).map((c) => c.date);
    expect(withEvent).toEqual(['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });

  it('однодневное событие занимает ровно одну ячейку', () => {
    const weeks = buildMonthGrid(OCT_2026, [event('2026-10-05', '2026-10-05', 'День учителя')]);
    const cells = weeks.flat().filter((c) => c.events.length > 0);
    expect(cells).toHaveLength(1);
    expect(cells[0]!.events[0]!.title).toBe('День учителя');
  });

  it('несколько событий в одном дне сохраняются оба', () => {
    const weeks = buildMonthGrid(OCT_2026, [
      event('2026-10-05', '2026-10-05', 'Первое'),
      event('2026-10-01', '2026-10-31', 'Второе'),
    ]);
    const cell = weeks.flat().find((c) => c.date === '2026-10-05')!;
    expect(cell.events.map((e) => e.title)).toEqual(['Первое', 'Второе']);
  });

  it('событие целиком вне сетки не попадает никуда', () => {
    const weeks = buildMonthGrid(OCT_2026, [event('2026-12-01', '2026-12-05')]);
    expect(weeks.flat().every((c) => c.events.length === 0)).toBe(true);
  });

  it('перевёрнутый период игнорируется, а не роняет сетку', () => {
    const weeks = buildMonthGrid(OCT_2026, [event('2026-10-10', '2026-10-01')]);
    expect(weeks.flat().every((c) => c.events.length === 0)).toBe(true);
  });
});

describe('shiftMonth', () => {
  it('переходит через границу года в обе стороны', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('шаг на несколько месяцев', () => {
    expect(shiftMonth(OCT_2026, 5)).toEqual({ year: 2027, month: 3 });
  });
});

describe('monthTitle / monthOf', () => {
  it('заголовок в именительном падеже', () => {
    expect(monthTitle(OCT_2026)).toBe('Октябрь 2026');
  });

  it('месяц вытаскивается из ISO-строки', () => {
    expect(monthOf('2026-10-28')).toEqual(OCT_2026);
  });
});

describe('formatEventDates', () => {
  it('одна дата', () => {
    expect(formatEventDates('2026-10-05', '2026-10-05')).toBe('5 окт 2026');
  });

  it('период внутри года — год один раз', () => {
    expect(formatEventDates('2026-10-28', '2026-11-05')).toBe('28 окт – 5 ноя 2026');
  });

  it('период через новый год — год у обеих границ', () => {
    expect(formatEventDates('2026-12-28', '2027-01-08')).toBe('28 дек 2026 – 8 янв 2027');
  });
});
