import { request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type PsychTestClassOption = Schema<'PsychTestClassOptionView'>;
export type PsychTestAssignment = Schema<'PsychTestAssignmentView'>;
export type AssignPsychTestRequest = Schema<'AssignPsychTestRequest'>;
export type PsychTestResults = Schema<'PsychTestResultsView'>;
export type PsychTestResultQuestion = Schema<'PsychTestResultQuestionView'>;
export type PsychTestStudentResult = Schema<'PsychTestStudentResultView'>;
export type PsychTestSavedAnswer = Schema<'PsychTestSavedAnswerView'>;

/**
 * Кабинет психолога: назначение психологического теста классам и именные результаты
 * (PSYCHOLOGIST-002, `fiztex-back/docs/psych-test-contract.md`).
 *
 * Весь раздел — только роль PSYCHOLOGIST: администратор получает 403, потому что
 * результаты психологической диагностики другим ролям не показываются. Классы для выбора
 * тоже берутся отсюда, а не из `/admin/classes`: тот психологу закрыт, и общий
 * `request()` на отказ завершил бы сессию.
 */
export const psychTestsApi = {
  /** Классы текущего учебного года с числом учеников — ровно для формы назначения. */
  classes(signal?: AbortSignal): Promise<PsychTestClassOption[]> {
    return request<PsychTestClassOption[]>('/admin/psych-tests/classes', { signal });
  },

  assignments(testId: number, signal?: AbortSignal): Promise<PsychTestAssignment[]> {
    return request<PsychTestAssignment[]>(`/admin/psych-tests/${testId}/assignments`, { signal });
  },

  /**
   * Назначение — снимок: получают тест ученики, которые состоят в классах сейчас. Повторное
   * назначение тому же классу, пока приём идёт, сервер отклоняет (`PSYCH_TEST_ALREADY_ASSIGNED`).
   */
  assign(testId: number, body: AssignPsychTestRequest): Promise<PsychTestAssignment> {
    return request<PsychTestAssignment>(`/admin/psych-tests/${testId}/assignments`, {
      method: 'POST',
      body,
    });
  },

  close(assignmentId: number): Promise<PsychTestAssignment> {
    return request<PsychTestAssignment>(`/admin/psych-tests/assignments/${assignmentId}/close`, {
      method: 'POST',
    });
  },

  /** `classId` сужает список учеников; вопросы — всегда те, что ученики видели. */
  results(assignmentId: number, classId?: number, signal?: AbortSignal): Promise<PsychTestResults> {
    const query = classId != null ? `?classId=${classId}` : '';
    return request<PsychTestResults>(`/admin/psych-tests/assignments/${assignmentId}/results${query}`, {
      signal,
    });
  },
};
