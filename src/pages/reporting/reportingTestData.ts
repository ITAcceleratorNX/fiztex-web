import type { ReportMetrics, ReportRow } from '@/lib/reportingModel';

/** Метрики отчёта, как их отдаёт сервер; переопределения — частичные блоки. */
export function metrics(overrides: Partial<ReportMetrics> = {}): ReportMetrics {
  return {
    lessons: { completedLessonCount: 186, state: 'AVAILABLE' },
    grades: {
      gradeCount: 40, scaleCount: 40, pointsCount: 0,
      scaleAverage: { value: 8.1, state: 'AVAILABLE' },
      periodResult: { state: 'AVAILABLE', mode: 'SCALE', result: null },
    },
    attendance: {
      publishedMarkCount: 100, presentCount: 94, missedCount: 6, lateCount: 3, excusedCount: 0,
      presencePercent: { value: 94, state: 'AVAILABLE' },
    },
    finalGrades: { publishedCount: 0 },
    academicPerformance: { value: null, state: 'DEPENDENCY_MISSING', reason: 'ACADEMIC_PERFORMANCE_NOT_IMPLEMENTED' },
    ...overrides,
  };
}

export const EMPTY = metrics({
  lessons: { completedLessonCount: 0, state: 'AVAILABLE' },
  grades: { gradeCount: 0, scaleCount: 0, pointsCount: 0, scaleAverage: { value: null, state: 'NO_DATA', reason: 'NO_SCALE_GRADES' } },
  attendance: { publishedMarkCount: 0, presencePercent: { value: null, state: 'NO_DATA', reason: 'NO_PUBLISHED_ATTENDANCE' } },
  finalGrades: { publishedCount: 0 },
});

export const NO_GRADES = metrics({
  grades: { gradeCount: 0, scaleCount: 0, pointsCount: 0, scaleAverage: { value: null, state: 'NO_DATA', reason: 'NO_SCALE_GRADES' } },
});

export function row(id: number, name: string, overrides: Partial<ReportRow> = {}): ReportRow {
  return { key: { id, name }, metrics: metrics(), attributes: {}, ...overrides };
}

/** Ответ хука TanStack Query в том виде, в каком его читают страницы. */
export function ok<T>(data: T) {
  return { data, isPending: false, isError: false, error: null, refetch: () => Promise.resolve({ data }) };
}
