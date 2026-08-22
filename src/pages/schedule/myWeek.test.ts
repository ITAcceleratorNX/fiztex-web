import { describe, expect, it } from 'vitest';
import type { RoleSchedule, RoleScheduleLesson } from '@/lib/lessonsApi';
import { lessonsAt, weekColumns, weekRows, weekState } from './myWeek';

const lesson = (over: Partial<RoleScheduleLesson>): RoleScheduleLesson => ({
  date: '2026-08-24',
  startTime: '08:00:00',
  lessonNumber: 1,
  subjectName: 'Математика',
  ...over,
});

describe('weekColumns', () => {
  it('колонки идут по учебным дням школы, а не по пятидневке', () => {
    const columns = weekColumns('2026-08-24', ['MONDAY', 'WEDNESDAY', 'SATURDAY'], '2026-08-26');
    expect(columns.map((c) => c.date)).toEqual(['2026-08-24', '2026-08-26', '2026-08-29']);
    expect(columns.map((c) => c.label)).toEqual(['Пн', 'Ср', 'Сб']);
    // Сегодняшний день подсвечен ровно один.
    expect(columns.filter((c) => c.isToday)).toHaveLength(1);
  });

  it('без недели колонок нет — рисовать не из чего', () => {
    expect(weekColumns(undefined, ['MONDAY'])).toEqual([]);
  });
});

describe('weekRows', () => {
  it('один номер урока — одна строка на всю неделю', () => {
    const rows = weekRows([
      lesson({ date: '2026-08-24', lessonNumber: 2, startTime: '08:55:00' }),
      lesson({ date: '2026-08-26', lessonNumber: 2, startTime: '09:50:00' }),
      lesson({ date: '2026-08-26', lessonNumber: 1, startTime: '08:00:00' }),
    ]);
    expect(rows.map((r) => r.number)).toEqual([1, 2]);
    // Время строки — самое раннее: у классов учителя бывают разные звонки.
    expect(rows[1].time).toBe('08:55');
  });

  it('урок без номера получает свою строку по времени, а не теряется', () => {
    const rows = weekRows([
      lesson({ lessonNumber: undefined, startTime: '14:00:00' }),
      lesson({ lessonNumber: 1, startTime: '08:00:00' }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[1].number).toBeNull();
  });
});

describe('lessonsAt', () => {
  it('в клетку попадают уроки этого дня и этой строки', () => {
    const lessons = [
      lesson({ date: '2026-08-24', lessonNumber: 1 }),
      lesson({ date: '2026-08-24', lessonNumber: 2 }),
      lesson({ date: '2026-08-26', lessonNumber: 1 }),
    ];
    expect(lessonsAt(lessons, 'n1', '2026-08-24')).toHaveLength(1);
    expect(lessonsAt(lessons, 'n3', '2026-08-24')).toHaveLength(0);
  });
});

describe('weekState', () => {
  it('пустая сетка честна только там, где расписание есть', () => {
    expect(weekState({ status: 'ok' } as RoleSchedule).kind).toBe('grid');
    expect(weekState({ status: 'no_assigned_lessons' } as RoleSchedule).kind).toBe('grid');
  });

  it('неопубликованное расписание объясняется, а не показывается пустой таблицей', () => {
    const state = weekState({ status: 'schedule_not_published' } as RoleSchedule);
    expect(state).toEqual({ kind: 'empty', message: 'Расписание на эту неделю ещё не опубликовано' });
  });

  it('объяснение бэкенда важнее нашего', () => {
    const state = weekState({
      status: 'calendar_no_lessons',
      message: 'Осенние каникулы',
    } as RoleSchedule);
    expect(state).toEqual({ kind: 'empty', message: 'Осенние каникулы' });
  });
});
