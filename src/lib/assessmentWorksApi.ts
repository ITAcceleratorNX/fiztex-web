import { pageQuery, request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type AssessmentResults = Schema<'AssessmentResultsView'>;
export type AssessmentStudentResult = Schema<'StudentResultView'>;
export type AssessmentHistory = Schema<'AssessmentHistoryView'>;
export type AssessmentResultEvent = Schema<'ResultHistoryEventView'>;
export type AssessmentWork = Schema<'AssessmentWorkView'>;
export type AssessmentLimits = Schema<'AssessmentLimitsView'>;
export type AssessmentKind = NonNullable<AssessmentWork['kind']>;

/**
 * Результаты работ СОР/СОЧ (`fiztex-back/docs/assessment-work-contract.md`).
 *
 * <p>Первичную выставку балла здесь не делают — только чтение и исправление СОЧ с причиной.
 * Кто вправе исправлять, называет сервер (`canCorrect`), а не роль в браузере.
 */
export const assessmentWorksApi = {
  create(lessonId: number, body: Schema<'CreateAssessmentWorkRequest'>): Promise<AssessmentWork> {
    return request<AssessmentWork>(`/lessons/${lessonId}/assessment-works`, { method: 'POST', body });
  },

  /** Сколько работ ещё можно назначить в охвате — подсказка до попытки. */
  limits(
    query: { classId: number; subjectId: number; academicPeriodId: number; subgroupId?: number | null },
    signal?: AbortSignal,
  ): Promise<AssessmentLimits> {
    return request<AssessmentLimits>(
      `/assessment-works/limits${pageQuery({ ...query, subgroupId: query.subgroupId ?? undefined })}`,
      { signal },
    );
  },

  update(workId: number, body: Schema<'UpdateAssessmentWorkRequest'>): Promise<AssessmentWork> {
    return request<AssessmentWork>(`/assessment-works/${workId}`, { method: 'PATCH', body });
  },

  conduct(workId: number): Promise<AssessmentWork> {
    return request<AssessmentWork>(`/assessment-works/${workId}/conduct`, { method: 'POST', body: {} });
  },

  cancel(workId: number, body: Schema<'CancelAssessmentWorkRequest'>): Promise<AssessmentWork> {
    return request<AssessmentWork>(`/assessment-works/${workId}/cancel`, { method: 'POST', body });
  },

  reschedule(workId: number, body: Schema<'RescheduleAssessmentWorkRequest'>): Promise<AssessmentWork> {
    return request<AssessmentWork>(`/assessment-works/${workId}/reschedule`, { method: 'POST', body });
  },

  /** Первичный балл (и правка СОР): 0…максимум, нет строки — не выставлен. */
  saveResult(
    workId: number,
    studentProfileId: number,
    body: Schema<'SaveAssessmentResultRequest'>,
  ): Promise<AssessmentStudentResult> {
    return request<AssessmentStudentResult>(`/assessment-works/${workId}/results/${studentProfileId}`, {
      method: 'PUT',
      body,
    });
  },

  results(workId: number, signal?: AbortSignal): Promise<AssessmentResults> {
    return request<AssessmentResults>(`/assessment-works/${workId}/results`, { signal });
  },

  history(workId: number, signal?: AbortSignal): Promise<AssessmentHistory> {
    return request<AssessmentHistory>(`/assessment-works/${workId}/history`, { signal });
  },

  /** Новый балл и обязательная причина; `expectedVersion` — версия, которую видел пользователь. */
  correct(
    workId: number,
    studentProfileId: number,
    body: Schema<'CorrectAssessmentResultRequest'>,
  ): Promise<AssessmentStudentResult> {
    return request<AssessmentStudentResult>(
      `/assessment-works/${workId}/results/${studentProfileId}/correction`,
      { method: 'POST', body },
    );
  },
};
