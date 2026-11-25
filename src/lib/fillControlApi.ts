import { pageQuery, request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type FillControlLesson = Schema<'FillControlLessonView'>;
export type FillControlSummary = Schema<'FillControlSummaryView'>;
export type FillControlFilters = Schema<'FillControlFiltersView'>;
export type FillAttendanceProblem = Schema<'AttendanceProblemView'>;
export type FillAssessmentProblem = Schema<'AssessmentProblemView'>;
type FillControlPage = Schema<'PageFillControlLessonView'>;

export type FillProblemType = 'ATTENDANCE' | 'ASSESSMENT';

export type FillControlQuery = {
  academicYearId?: number | null;
  academicPeriodId?: number | null;
  classId?: number | null;
  subjectId?: number | null;
  /** Только у администрации: учителю и классному руководителю сервер отвечает 403. */
  teacherProfileId?: number | null;
  problem?: FillProblemType | null;
  page?: number;
  size?: number;
};

function common(query: FillControlQuery) {
  return {
    academicYearId: query.academicYearId ?? undefined,
    academicPeriodId: query.academicPeriodId ?? undefined,
    classId: query.classId ?? undefined,
    subjectId: query.subjectId ?? undefined,
    teacherProfileId: query.teacherProfileId ?? undefined,
  };
}

/**
 * Контроль заполнения журнала (`/api/gradebook/fill-control`, контракт
 * `fiztex-back/docs/journal-fill-control-contract.md`). Только чтение: заполняют существующие
 * эндпоинты посещаемости и результатов работ, а что проблема и что можно править — решает сервер.
 */
export const fillControlApi = {
  lessons(query: FillControlQuery, signal?: AbortSignal): Promise<FillControlPage> {
    return request<FillControlPage>(
      `/gradebook/fill-control/lessons${pageQuery({
        ...common(query),
        problem: query.problem ?? undefined,
        page: query.page ?? 0,
        size: query.size ?? 20,
      })}`,
      { signal },
    );
  },

  /** Счётчики без фильтра по типу: «Всё / Посещаемость / СОР/СОЧ» берутся отсюда. */
  summary(query: FillControlQuery, signal?: AbortSignal): Promise<FillControlSummary> {
    return request<FillControlSummary>(
      `/gradebook/fill-control/summary${pageQuery(common(query))}`,
      { signal },
    );
  },

  filters(academicYearId?: number | null, classId?: number | null, signal?: AbortSignal): Promise<FillControlFilters> {
    return request<FillControlFilters>(
      `/gradebook/fill-control/filters${pageQuery({ academicYearId: academicYearId ?? undefined, classId: classId ?? undefined })}`,
      { signal },
    );
  },
};
