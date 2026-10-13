import { describe, expect, it } from 'vitest';
import { buildScheduleWeek, mondayOf, roomLabel, weekLabel, weekParts } from './myClassScheduleModel';

const periods = [
  { id: 1, name: '1', startDate: '2026-09-01', endDate: '2026-10-25' },
  { id: 2, name: '2', startDate: '2026-11-02', endDate: '2026-12-28' },
];

describe('week helpers', () => {
  it('stores the week by its Monday and labels the range like the design', () => {
    expect(mondayOf('2026-10-07')).toBe('2026-10-05');
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
    expect(weekLabel('2026-10-12', '2026-10-16')).toBe('12 – 16 октября 2026');
    expect(weekLabel('2026-09-28', '2026-10-02')).toBe('28 сентября – 2 октября 2026');
    expect(weekLabel('2026-12-28', '2027-01-01')).toBe('28 декабря 2026 – 1 января 2027');
  });

  it('splits the week by periods and skips the holidays between them', () => {
    expect(weekParts(periods, '2026-10-19')).toEqual([{ periodId: 1, from: '2026-10-19', to: '2026-10-25' }]);
    expect(weekParts(periods, '2026-10-26')).toEqual([]);
    expect(weekParts(periods, '2026-11-02')).toEqual([{ periodId: 2, from: '2026-11-02', to: '2026-11-08' }]);
  });

  it('prefixes numeric rooms only', () => {
    expect(roomLabel('312')).toBe('Каб. 312');
    expect(roomLabel('Спортзал')).toBe('Спортзал');
    expect(roomLabel(' ')).toBeNull();
  });
});

describe('buildScheduleWeek', () => {
  const fact = {
    lessonId: 10, date: '2026-10-07', startTime: '08:00:00', endTime: '08:45:00', lessonNumber: 1,
    status: 'ACTIVE' as const, subjectName: 'Физика', teacherName: 'Сидоров Сергей Сергеевич',
    room: '101', canOpen: true,
  };

  it('draws facts with substitutions, cancellations and links only where the card opens', () => {
    const week = buildScheduleWeek([{
      from: '2026-10-05', to: '2026-10-11', factState: 'FACTS_AVAILABLE_COVERAGE_UNKNOWN', planState: 'PUBLISHED',
      facts: [
        fact,
        { ...fact, lessonId: 11, date: '2026-10-08', canOpen: false, substituteTeacherName: 'Иванова Мария Викторовна' },
        { ...fact, lessonId: 12, date: '2026-10-09', lessonNumber: 2, startTime: '08:55:00', endTime: '09:40:00', status: 'CANCELLED' },
      ],
      plan: { slots: [{ scheduleLessonId: 1, weekday: 'MONDAY', lessonNumber: 1, subjectName: 'Химия' }] },
    }], '2026-10-05', '2026-10-07');

    expect(week.kind).toBe('facts');
    if (week.kind !== 'facts') return;
    expect(week.columns.map((column) => [column.weekday, column.label, column.isToday])).toEqual([
      ['Понедельник', '05.10', false], ['Вторник', '06.10', false], ['Среда', '07.10', true],
      ['Четверг', '08.10', false], ['Пятница', '09.10', false],
    ]);
    expect(week.rows.map((row) => [row.number, row.label])).toEqual([[1, '08:00–08:45'], [2, '08:55–09:40']]);
    expect(week.entries.map((entry) => [entry.teacher, entry.substituted, entry.cancelled, entry.lessonId])).toEqual([
      ['Сидоров С.С.', false, false, 10],
      ['Иванова М.В.', true, false, null],
      ['Сидоров С.С.', false, true, 12],
    ]);
    expect(week.entries.some((entry) => entry.subject === 'Химия')).toBe(false);
  });

  it('falls back to the published plan inside the period and to empty without it', () => {
    const planWeek = buildScheduleWeek([{
      from: '2026-10-19', to: '2026-10-25', factState: 'NO_FACTS_AVAILABLE', planState: 'PUBLISHED', facts: [],
      plan: { slots: [
        { scheduleLessonId: 1, weekday: 'MONDAY', lessonNumber: 1, startTime: '08:00:00', endTime: '08:45:00', subjectName: 'Химия', room: '307' },
        { scheduleLessonId: 2, weekday: 'SATURDAY', lessonNumber: 1, startTime: '08:00:00', endTime: '08:45:00', subjectName: 'Музыка' },
      ] },
    }], '2026-10-19', '2026-10-07');
    expect(planWeek.kind).toBe('plan');
    if (planWeek.kind !== 'plan') return;
    expect(planWeek.columns.map((column) => column.weekday)).toContain('Суббота');
    expect(planWeek.entries.every((entry) => entry.lessonId == null)).toBe(true);

    expect(buildScheduleWeek([{ facts: [], planState: 'NOT_PUBLISHED' }], '2026-10-19', '2026-10-07').kind).toBe('empty');
    expect(buildScheduleWeek([], '2026-10-26', '2026-10-07').kind).toBe('outside');
  });
});
