import { describe, expect, it } from 'vitest';
import type { TeacherJournal, TeacherJournalLesson } from '@/lib/attendanceApi';
import {
  dayMarkOf,
  defaultMonth,
  journalRows,
  monthDays,
  parseScopeKey,
  scopeKey,
  scopeLabel,
  shortName,
  shortNames,
  yearMonths,
} from './attendanceJournalModel';

const A = 1;
const B = 2;

function lesson(overrides: Partial<TeacherJournalLesson>): TeacherJournalLesson {
  return {
    lessonId: 100,
    lessonDate: '2026-09-01',
    startTime: '08:30:00',
    endTime: '09:15:00',
    subjectName: 'Математика',
    classId: 10,
    className: '5А',
    subgroupId: undefined,
    status: 'ACTIVE',
    state: 'PUBLISHED',
    markedCount: 2,
    totalCount: 2,
    entries: [],
    ...overrides,
  };
}

function journal(lessons: TeacherJournalLesson[]): TeacherJournal {
  return {
    month: '2026-09',
    lessons,
    students: [
      { studentProfileId: A, fullName: 'Александров Дмитрий Сергеевич' },
      { studentProfileId: B, fullName: 'Белова Кристина Андреевна' },
    ],
  };
}

const TODAY = '2026-09-20';

function marksOf(data: TeacherJournal, studentId: number, date: string, subgroupFiltered = false) {
  const row = journalRows(data, { subgroupFiltered, today: TODAY }).find(
    (candidate) => candidate.student.studentProfileId === studentId,
  );
  return row?.cells.get(date)?.marks ?? [];
}

describe('отметка → клетка', () => {
  it('опоздание — посещение с оранжевой точкой, освобождение — не пропуск', () => {
    expect(dayMarkOf({ status: 'PRESENT' })).toBe('present');
    expect(dayMarkOf({ status: 'PRESENT', mark: 'LATE' })).toBe('late');
    expect(dayMarkOf({ status: 'ABSENT', reason: 'ILLNESS' })).toBe('absent');
    expect(dayMarkOf({ status: 'ABSENT', mark: 'EXCUSED' })).toBe('excused');
    expect(dayMarkOf({ status: 'NOT_MARKED' })).toBeNull();
    expect(dayMarkOf(null)).toBeNull();
  });
});

describe('месяц', () => {
  it('сентябрь 2026 — 30 дней, 1-е вторник, выходные помечены', () => {
    const days = monthDays('2026-09');
    expect(days).toHaveLength(30);
    expect(days[0]).toEqual({ date: '2026-09-01', label: '01', weekday: 'Вт', weekend: false });
    expect(days[4]).toMatchObject({ label: '05', weekday: 'Сб', weekend: true });
    expect(days[5]).toMatchObject({ label: '06', weekday: 'Вс', weekend: true });
  });

  it('месяцы учебного года строятся из его границ, через Новый год', () => {
    expect(yearMonths({ startDate: '2026-09-01', endDate: '2027-05-29' })).toEqual([
      '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05',
    ]);
    expect(yearMonths(null)).toEqual([]);
  });

  it('по умолчанию — текущий месяц, летом — последний прошедший, до начала года — первый', () => {
    const months = ['2026-09', '2026-10', '2026-11'];
    expect(defaultMonth(months, '2026-10')).toBe('2026-10');
    expect(defaultMonth(months, '2027-07')).toBe('2026-11');
    expect(defaultMonth(months, '2026-08')).toBe('2026-09');
    expect(defaultMonth([], '2026-10')).toBeUndefined();
  });
});

describe('класс и подгруппа в адресе', () => {
  it('ключ читается обратно', () => {
    expect(parseScopeKey(scopeKey({ classId: 12 }))).toEqual({ classId: 12, subgroupId: null });
    expect(parseScopeKey(scopeKey({ classId: 12, subgroupId: 34 }))).toEqual({ classId: 12, subgroupId: 34 });
    expect(parseScopeKey('мусор')).toBeNull();
    expect(parseScopeKey(null)).toBeNull();
  });

  it('подпись как в макете', () => {
    expect(scopeLabel({ classId: 1, className: '5А', subgroupName: 'Подгруппа 1' })).toBe('5А — Подгруппа 1');
    expect(scopeLabel({ classId: 1, className: '5А', subgroupName: 'Подгруппа 1' }, ' · ')).toBe(
      '5А · Подгруппа 1',
    );
    expect(scopeLabel({ classId: 1, className: '5А' })).toBe('5А');
  });

  it('ФИО сокращается до инициалов', () => {
    expect(shortName('Александров Дмитрий Сергеевич')).toBe('Александров Д.С.');
    expect(shortName('Белова Кристина')).toBe('Белова К.');
    expect(shortName('Моно')).toBe('Моно');
  });

  it('совпавшие инициалы различаются именем целиком — остальные остаются короткими', () => {
    expect(
      shortNames([
        'Амангельдиева Айгерим Маратқызы',
        'Амангельдиева Айгуль Маратқызы',
        'Бекмуратов Айдар Талғатұлы',
      ]),
    ).toEqual(['Амангельдиева Айгерим М.', 'Амангельдиева Айгуль М.', 'Бекмуратов А.Т.']);
  });
});

describe('уроки → клетки дней', () => {
  it('опубликованная отметка красит клетку, неопубликованная — серая', () => {
    const data = journal([
      lesson({
        lessonDate: '2026-09-01',
        entries: [
          { studentProfileId: A, attendance: { status: 'PRESENT', mark: 'LATE' } },
          { studentProfileId: B, attendance: undefined },
        ],
      }),
    ]);
    expect(marksOf(data, A, '2026-09-01')).toEqual(['late']);
    expect(marksOf(data, B, '2026-09-01')).toEqual(['unpublished']);
  });

  it('незаполненный урок класса — серая точка у всех', () => {
    const data = journal([lesson({ state: 'NOT_FILLED', entries: [], markedCount: 0, totalCount: 0 })]);
    expect(marksOf(data, A, '2026-09-01')).toEqual(['unpublished']);
    expect(marksOf(data, B, '2026-09-01')).toEqual(['unpublished']);
  });

  it('незаполненный урок подгруппы виден только в журнале этой подгруппы', () => {
    const data = journal([lesson({ subgroupId: 7, state: 'NOT_FILLED', entries: [] })]);
    expect(marksOf(data, A, '2026-09-01')).toEqual([]);
    expect(marksOf(data, A, '2026-09-01', true)).toEqual(['unpublished']);
  });

  it('заполненный урок подгруппы — только у её учеников, по строкам листа', () => {
    const data = journal([
      lesson({ subgroupId: 7, entries: [{ studentProfileId: A, attendance: { status: 'ABSENT' } }] }),
    ]);
    expect(marksOf(data, A, '2026-09-01')).toEqual(['absent']);
    expect(marksOf(data, B, '2026-09-01')).toEqual([]);
  });

  it('отменённый урок — кольцо, будущий — пусто', () => {
    const data = journal([
      lesson({ lessonDate: '2026-09-02', status: 'CANCELLED', state: 'ANNULLED' }),
      lesson({ lessonDate: '2026-09-25', state: 'NOT_FILLED' }),
    ]);
    expect(marksOf(data, A, '2026-09-02')).toEqual(['cancelled']);
    expect(marksOf(data, A, '2026-09-25')).toEqual([]);
  });

  it('два урока в день — две точки по времени, подсказка перечисляет оба', () => {
    const data = journal([
      lesson({
        lessonId: 2,
        startTime: '10:30:00',
        subjectName: 'Геометрия',
        entries: [{ studentProfileId: A, attendance: { status: 'ABSENT', mark: 'EXCUSED' } }],
      }),
      lesson({
        lessonId: 1,
        startTime: '08:30:00',
        subjectName: 'Алгебра',
        entries: [{ studentProfileId: A, attendance: { status: 'PRESENT' } }],
      }),
    ]);
    const row = journalRows(data, { subgroupFiltered: false, today: TODAY })[0];
    const cell = row.cells.get('2026-09-01');
    expect(cell?.marks).toEqual(['present', 'excused']);
    expect(cell?.title).toBe('08:30 Алгебра — Присутствовал\n10:30 Геометрия — Освобождён');
    expect(row.shortName).toBe('Александров Д.С.');
  });
});
