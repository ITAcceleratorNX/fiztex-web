import { describe, expect, it } from 'vitest';
import {
  defaultMonthValue,
  monthLabel,
  monthOptionsOfYear,
  reasonBreakdownRows,
} from './attendanceAdminModel';

const YEAR = { startDate: '2026-09-01', endDate: '2027-05-25' };

describe('attendanceAdminModel', () => {
  it('месяцы берутся из границ года, включая неполные крайние', () => {
    const options = monthOptionsOfYear(YEAR);

    expect(options).toHaveLength(9);
    expect(options[0]).toEqual({ value: '2026-09', label: 'Сентябрь 2026' });
    // Май входит целиком, хотя год кончается 25-го: месяц — это окно запроса, а не период.
    expect(options[options.length - 1]).toEqual({ value: '2027-05', label: 'Май 2027' });
  });

  /**
   * Каникулы между четвертями — это тоже месяц, в котором бывают незакрытые уроки.
   * Поэтому список строится по году, а не по периодам, как в журнале оценок.
   */
  it('январь на стыке четвертей из списка не выпадает', () => {
    expect(monthOptionsOfYear(YEAR).map((option) => option.value)).toContain('2027-01');
  });

  it('год без дат даёт пустой список, а не сегодняшний месяц', () => {
    expect(monthOptionsOfYear(null)).toEqual([]);
    expect(monthOptionsOfYear({ startDate: '2026-09-01' })).toEqual([]);
    expect(monthOptionsOfYear({ startDate: '2027-05-25', endDate: '2026-09-01' })).toEqual([]);
  });

  it('по умолчанию открывается текущий месяц, а у закончившегося года — последний', () => {
    const options = monthOptionsOfYear(YEAR);

    expect(defaultMonthValue(options, new Date(2026, 10, 12))).toBe('2026-11');
    // Год давно закончился: показывать пустой июль незачем.
    expect(defaultMonthValue(options, new Date(2027, 7, 1))).toBe('2027-05');
    expect(defaultMonthValue([], new Date(2026, 10, 12))).toBeNull();
  });

  it('подпись месяца берётся из того же списка, что и селект', () => {
    const options = monthOptionsOfYear(YEAR);

    expect(monthLabel(options, '2026-10')).toBe('Октябрь 2026');
    expect(monthLabel(options, '2030-01')).toBeNull();
  });

  it('причины идут от частой к редкой, нули и пустая разбивка отбрасываются', () => {
    const rows = reasonBreakdownRows({ ILLNESS: 4, TRANSPORT: 0, UNEXCUSED: 7 });

    expect(rows.map((row) => row.reason)).toEqual(['UNEXCUSED', 'ILLNESS']);
    expect(rows[0]).toMatchObject({ label: 'Без уважительной причины', count: 7 });
    expect(reasonBreakdownRows(undefined)).toEqual([]);
  });
});
