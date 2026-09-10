import { pageQuery, request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

/**
 * Опросы, раздел администратора (`SurveyAdminController`).
 *
 * Тонкая обёртка поверх сгенерированных типов — как `homeworkApi.ts` и `gradesApi.ts`,
 * без собственной логики: правила жизненного цикла (что можно менять в каком статусе,
 * что требует публикация) живут на бэкенде и пересказаны в `surveyModel.ts` только там,
 * где экрану нужно заранее выключить кнопку, а не гадать после 409.
 */

export type Survey = Schema<'SurveyView'>;
export type SurveyListItem = Schema<'SurveyListItemView'>;
export type SurveyPage = Schema<'PageSurveyListItemView'>;
export type SurveyQuestion = Schema<'SurveyQuestionView'>;
export type SurveyAnswerOption = Schema<'SurveyAnswerOptionView'>;
export type SurveyStats = Schema<'SurveyStatsView'>;
export type QuestionStats = Schema<'QuestionStatsView'>;
export type OptionStat = Schema<'OptionStatView'>;
export type SurveyAiAnalysis = Schema<'SurveyAiAnalysisView'>;
export type SurveyAiJob = Schema<'SurveyAiJobView'>;

export type CreateSurveyRequest = Schema<'CreateSurveyRequest'>;
export type UpdateSurveyRequest = Schema<'UpdateSurveyRequest'>;
export type SaveSurveyQuestionsRequest = Schema<'SaveSurveyQuestionsRequest'>;
export type SurveyQuestionRequest = Schema<'SurveyQuestionRequest'>;
export type SurveyAnswerOptionRequest = Schema<'SurveyAnswerOptionRequest'>;
export type SetSurveyAudienceRequest = Schema<'SetSurveyAudienceRequest'>;

export type SurveyStatus = NonNullable<Survey['status']>;
export type SurveyMode = NonNullable<Survey['mode']>;
export type SurveyQuestionType = NonNullable<SurveyQuestion['type']>;
export type SurveyAiScope = NonNullable<SurveyAiJob['scope']>;
export type SurveyAiJobStatus = NonNullable<SurveyAiJob['status']>;

/**
 * Ключ идемпотентности запуска AI-анализа — тот же протокол, что у генерации ДЗ
 * (`homeworkAiApi.ts`): один ключ на нажатие кнопки, повтор с ним не тратит вторую задачу.
 */
function idempotent(key: string) {
  return { 'Idempotency-Key': key };
}

export const surveyApi = {
  list: (status?: SurveyStatus, signal?: AbortSignal) =>
    request<SurveyPage>(`/admin/surveys${pageQuery({ status })}`, { signal }),

  card: (id: number, signal?: AbortSignal) => request<Survey>(`/admin/surveys/${id}`, { signal }),

  create: (body: CreateSurveyRequest) => request<Survey>('/admin/surveys', { method: 'POST', body }),

  update: (id: number, body: UpdateSurveyRequest) =>
    request<Survey>(`/admin/surveys/${id}`, { method: 'PUT', body }),

  questions: (id: number, signal?: AbortSignal) =>
    request<SurveyQuestion[]>(`/admin/surveys/${id}/questions`, { signal }),

  /** 409 `SURVEY_NOT_EDITABLE`, если опрос не в `DRAFT` (правит содержимое только черновик). */
  saveQuestions: (id: number, body: SaveSurveyQuestionsRequest) =>
    request<SurveyQuestion[]>(`/admin/surveys/${id}/questions`, { method: 'PUT', body }),

  /** 409 `SURVEY_NOT_EDITABLE` — та же граница, что у вопросов. */
  setAudience: (id: number, body: SetSurveyAudienceRequest) =>
    request<Survey>(`/admin/surveys/${id}/audience`, { method: 'PUT', body }),

  /** 409 `SURVEY_NO_QUESTIONS` / `SURVEY_NO_AUDIENCE` / `SURVEY_NO_TARGET`, если предусловия не выполнены. */
  publish: (id: number) => request<Survey>(`/admin/surveys/${id}/publish`, { method: 'POST' }),

  /** 409 `SURVEY_NOT_ACTIVE`, если опрос не идёт сейчас. */
  end: (id: number) => request<Survey>(`/admin/surveys/${id}/end`, { method: 'POST' }),

  stats: (id: number, classId?: number, signal?: AbortSignal) =>
    request<SurveyStats>(`/admin/surveys/${id}/stats${pageQuery({ classId })}`, { signal }),

  /**
   * Последний посчитанный анализ. Ничего не запускает — только отдаёт кэш и признак
   * `stale`: новые ответы после последнего расчёта.
   */
  aiAnalysis: (id: number, scope: SurveyAiScope, classId: number | undefined, signal?: AbortSignal) =>
    request<SurveyAiAnalysis>(`/admin/surveys/${id}/ai-analysis${pageQuery({ scope, classId })}`, {
      signal,
    }),

  /** Запуск новой задачи анализа — асинхронно, 202 + `SurveyAiJobView`. */
  triggerAiAnalysis: (id: number, scope: SurveyAiScope, classId: number | undefined, key: string) =>
    request<SurveyAiJob>(`/admin/surveys/${id}/ai-analysis${pageQuery({ scope, classId })}`, {
      method: 'POST',
      headers: idempotent(key),
    }),
};
