import { describe, expect, it } from 'vitest';
import { buildAttendanceJournal } from './myClassAttendanceModel';

describe('buildAttendanceJournal', () => {
  it('turns server cells into dots and keeps a missing cell for lessons of another subgroup', () => {
    const { columns, rows } = buildAttendanceJournal({
      lessons: [
        { lessonId: 1, date: '2026-09-02', startTime: '09:00:00', status: 'ACTIVE' },
        { lessonId: 2, date: '2026-09-05', startTime: '10:00:00', status: 'ACTIVE', subgroupId: 7, subgroupName: 'Группа 1' },
        { lessonId: 3, date: '2026-09-09', startTime: '09:00:00', status: 'CANCELLED' },
      ],
      rows: [
        {
          studentProfileId: 10,
          studentName: 'Александрова Светлана Петровна',
          cells: [
            { lessonId: 1, state: 'LATE' },
            { lessonId: 2, state: 'NOT_PUBLISHED' },
            { lessonId: 3, state: 'CANCELLED' },
          ],
        },
        { studentProfileId: 11, studentName: 'Белов Арман', cells: [{ lessonId: 1, state: 'EXCUSED' }] },
      ],
    });

    expect(columns.map((column) => [column.date, column.event])).toEqual([
      ['02.09', 'Урок'], ['05.09', 'Группа 1'], ['09.09', 'Отменён'],
    ]);
    expect(columns[1].title).toBe('05.09 · 10:00 · Группа 1');
    expect(rows[0].shortName).toBe('Александрова С.П.');
    expect([...rows[0].cells.values()].map((cell) => cell.mark)).toEqual(['late', 'unpublished', 'cancelled']);
    expect(rows[0].cells.get(1)?.title).toBe('02.09 · 09:00 — Опоздал');
    expect(rows[1].cells.get(1)?.mark).toBe('excused');
    expect(rows[1].cells.has(2)).toBe(false);
  });
});
