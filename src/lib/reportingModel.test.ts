import { describe, expect, it } from 'vitest';
import {
  attendanceDisplay,
  averageDisplay,
  badgeLetters,
  counted,
  hasPartialData,
  isEmptyReport,
  lessonsDisplay,
  namesLabel,
  performanceDisplay,
  periodFinalsByStudent,
  periodLabel,
  STUDENTS,
  type ReportMetrics,
  type ReportRow,
} from './reportingModel';

function metrics(overrides: Partial<ReportMetrics> = {}): ReportMetrics {
  return {
    lessons: { completedLessonCount: 36, state: 'AVAILABLE' },
    grades: {
      gradeCount: 10, scaleCount: 10, pointsCount: 0,
      scaleAverage: { value: 7.85, state: 'AVAILABLE' },
      periodResult: { state: 'AVAILABLE', mode: 'SCALE', result: null },
    },
    attendance: {
      publishedMarkCount: 40, presentCount: 38, missedCount: 2, lateCount: 1, excusedCount: 0,
      presencePercent: { value: 95, state: 'AVAILABLE' },
    },
    finalGrades: { publishedCount: 0 },
    academicPerformance: { value: null, state: 'DEPENDENCY_MISSING', reason: 'ACADEMIC_PERFORMANCE_NOT_IMPLEMENTED' },
    ...overrides,
  };
}

describe('reportingModel', () => {
  it('shows server values as they come, without its own rounding', () => {
    expect(averageDisplay(metrics()).text).toBe('7,85');
    expect(averageDisplay(metrics({ grades: { ...metrics().grades, scaleAverage: { value: 8, state: 'AVAILABLE' } } })).text)
      .toBe('8,00');
    expect(attendanceDisplay(metrics()).text).toBe('95%');
    expect(lessonsDisplay(metrics({ lessons: { completedLessonCount: 4380 } })).text).toBe('4 380');
  });

  it('never turns a missing value into zero and explains the dash', () => {
    const noGrades = averageDisplay(metrics({ grades: { gradeCount: 0, scaleCount: 0, pointsCount: 0,
      scaleAverage: { value: null, state: 'NO_DATA', reason: 'NO_SCALE_GRADES' } } }));
    expect(noGrades).toEqual({ text: '—', hint: 'За период оценки не выставлялись', missing: true });

    const noAttendance = attendanceDisplay(metrics({ attendance: { publishedMarkCount: 0,
      presencePercent: { value: null, state: 'NO_DATA', reason: 'NO_PUBLISHED_ATTENDANCE' } } }));
    expect(noAttendance.text).toBe('—');
    expect(noAttendance.hint).toBe('Посещаемость за период не отмечалась');

    expect(performanceDisplay(metrics()).text).toBe('—');
    expect(performanceDisplay(metrics()).missing).toBe(true);
  });

  it('shows the policy percent only where the server calculated it', () => {
    const points = metrics({ grades: { gradeCount: 3, scaleCount: 0, pointsCount: 3,
      scaleAverage: { value: null, state: 'NO_DATA' },
      periodResult: { state: 'AVAILABLE', mode: 'POINTS', result: { roundedPercent: 84 } } } });
    expect(averageDisplay(points).text).toBe('84%');

    const notSupported = metrics({ grades: { gradeCount: 3, scaleCount: 0, pointsCount: 3,
      scaleAverage: { value: null, state: 'NO_DATA' },
      periodResult: { state: 'SCOPE_NOT_SUPPORTED', reason: 'SINGLE_STUDENT_SUBJECT_PERIOD_REQUIRED' } } });
    expect(averageDisplay(notSupported).missing).toBe(true);
  });

  it('detects empty and partially filled reports', () => {
    const empty = metrics({
      lessons: { completedLessonCount: 0 },
      grades: { gradeCount: 0, scaleAverage: { state: 'NO_DATA' } },
      attendance: { publishedMarkCount: 0, presencePercent: { state: 'NO_DATA' } },
      finalGrades: { publishedCount: 0 },
    });
    expect(isEmptyReport(empty)).toBe(true);
    expect(isEmptyReport(metrics())).toBe(false);

    const full: ReportRow = { key: { id: 1, name: '5 «А»' }, metrics: metrics() };
    const gap: ReportRow = { key: { id: 2, name: '1 «А»' }, metrics: empty };
    expect(hasPartialData([full, gap])).toBe(true);
    expect(hasPartialData([full, full])).toBe(false);
    expect(hasPartialData([gap, gap])).toBe(false);
  });

  it('takes period finals by student for one subject', () => {
    const finals = periodFinalsByStudent([
      { finalScope: 'PERIOD', value: 5, student: { id: 1 }, subject: { id: 9 } },
      { finalScope: 'YEAR', value: 4, student: { id: 2 }, subject: { id: 9 } },
      { finalScope: 'PERIOD', value: 3, student: { id: 3 }, subject: { id: 8 } },
    ], 9);
    expect([...finals.entries()]).toEqual([[1, 5]]);
  });

  it('labels periods, counts, names and badges like the design', () => {
    expect(periodLabel({ name: '1 четверть', startDate: '2026-09-01', endDate: '2026-10-31' })).toBe('1 четверть (01.09 – 31.10)');
    expect(periodLabel(null)).toBe('Весь учебный год');
    expect(counted(24, STUDENTS)).toBe('24 ученика');
    expect(counted(612, STUDENTS)).toBe('612 учеников');
    expect(namesLabel([{ name: 'Смирнова Е.А.' }, { name: 'Дмитриев Р.С.' }])).toBe('Смирнова Е.А., Дмитриев Р.С.');
    expect(namesLabel([{ name: 'А' }, { name: 'Б' }, { name: 'В' }])).toBe('А, Б и ещё 1');
    expect(badgeLetters('Математика')).toBe('М');
    expect(badgeLetters('Английский язык')).toBe('АЯ');
    expect(badgeLetters('8 «А»')).toBe('8А');
  });
});
