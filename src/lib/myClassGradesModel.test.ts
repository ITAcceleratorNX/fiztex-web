import { describe, expect, it } from 'vitest';
import type { Schema } from '@/lib/apiSchemas';
import {
  buildMyClassJournal,
  defaultSubjectId,
  gradeTitle,
  periodLabel,
  periodNoun,
} from './myClassGradesModel';

type Grade = Schema<'MyClassGradeItemView'>;

function grade(overrides: Partial<Grade>): Grade {
  return {
    gradeId: 1,
    studentProfileId: 10,
    sourceType: 'LESSON',
    sourceId: 100,
    sourceDate: '2026-09-02',
    sourceClassId: 7,
    sourceClassName: '8А',
    scaleCode: '4',
    gradeType: 'OTHER',
    publishedAt: '2026-09-02T05:00:00Z',
    ...overrides,
  };
}

const students = [
  { studentProfileId: 10, displayName: 'Александров Дмитрий Сергеевич' },
  { studentProfileId: 11, displayName: 'Белов Арман' },
];

describe('buildMyClassJournal', () => {
  it('builds date-ordered source columns and keeps students without grades', () => {
    const journal = buildMyClassJournal({
      students,
      grades: [
        grade({ gradeId: 3, sourceId: 102, sourceDate: '2026-09-26', gradeType: 'SUMMATIVE_SECTION', score: 15, maxScore: 20, scaleCode: undefined }),
        grade({ gradeId: 2, sourceType: 'HOMEWORK', sourceId: 5, sourceDate: '2026-09-05' }),
        grade({ gradeId: 1 }),
      ],
      finals: [{ finalGradeId: 9, studentProfileId: 10, value: 4 }],
      results: [{ studentProfileId: 10, averageGrade: 4, scaleGradeCount: 2 }],
    });

    expect(journal.columns).toEqual([
      { key: 'LESSON:100', date: '2026-09-02', kind: 'LESSON' },
      { key: 'HOMEWORK:5', date: '2026-09-05', kind: 'HOMEWORK' },
      { key: 'LESSON:102', date: '2026-09-26', kind: 'SOR' },
    ]);
    expect(journal.rows.map((row) => row.shortName)).toEqual(['Александров Д.С.', 'Белов А.']);
    expect(journal.rows[0].cells.get('LESSON:102')?.map((item) => item.gradeId)).toEqual([3]);
    expect(journal.rows[0].finals).toHaveLength(1);
    expect(journal.rows[0].result?.averageGrade).toBe(4);
    expect(journal.rows[1].cells.size).toBe(0);
    expect(journal.rows[1].result).toBeNull();
  });

  it('marks a column as СОЧ over СОР and drops grades of students outside the roster', () => {
    const journal = buildMyClassJournal({
      students,
      grades: [
        grade({ gradeId: 1, gradeType: 'SUMMATIVE_SECTION' }),
        grade({ gradeId: 2, studentProfileId: 11, gradeType: 'SUMMATIVE_TERM' }),
        grade({ gradeId: 3, studentProfileId: 99, sourceId: 200 }),
      ],
      finals: [],
      results: [],
    });

    expect(journal.columns).toEqual([{ key: 'LESSON:100', date: '2026-09-02', kind: 'SOCH' }]);
  });

  it('orders grades inside a cell by publication time', () => {
    const journal = buildMyClassJournal({
      students,
      grades: [
        grade({ gradeId: 5, publishedAt: '2026-09-02T09:00:00Z' }),
        grade({ gradeId: 4, publishedAt: '2026-09-02T08:00:00Z' }),
      ],
      finals: [],
      results: [],
    });

    expect(journal.rows[0].cells.get('LESSON:100')?.map((item) => item.gradeId)).toEqual([4, 5]);
  });
});

describe('labels', () => {
  it('names the grade type and the source class after a transfer', () => {
    expect(gradeTitle(grade({ gradeType: 'ORAL_ANSWER' }), 7)).toBe('Устный ответ · 02.09');
    expect(gradeTitle(grade({ sourceClassId: 8, sourceClassName: '8Б' }), 7))
      .toBe('Другое · 02.09 · получена в классе 8Б');
  });

  it('describes the period by its type and bounds', () => {
    const period = { id: 1, name: '1 четверть', type: 'QUARTER' as const, startDate: '2026-09-01', endDate: '2026-10-27' };
    expect(periodLabel(period)).toBe('1 четверть (01.09 – 27.10)');
    expect(periodNoun(period)).toBe('четверть');
    expect(periodNoun({ ...period, type: 'SEMESTER' })).toBe('полугодие');
    expect(periodNoun(undefined)).toBe('период');
  });

  it('opens the first subject that already has grades', () => {
    expect(defaultSubjectId([
      { subjectId: 1, subjectName: 'Алгебра', gradeCount: 0 },
      { subjectId: 2, subjectName: 'Физика', gradeCount: 3 },
    ])).toBe(2);
    expect(defaultSubjectId([{ subjectId: 1, subjectName: 'Алгебра', gradeCount: 0 }])).toBe(1);
    expect(defaultSubjectId([])).toBeNull();
  });
});
