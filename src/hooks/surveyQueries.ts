import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { surveyApi } from '@/lib/surveyApi';
import type {
  CreateSurveyRequest,
  SaveSurveyQuestionsRequest,
  SetSurveyAudienceRequest,
  SurveyAiScope,
  SurveyStatus,
  UpdateSurveyRequest,
} from '@/lib/surveyApi';

/**
 * React Query хуки опросов — отдельным файлом от `hooks/queries.ts` (тот уже за
 * полторы тысячи строк): раздел цельный, со своим протоколом (AI-анализ, публикация,
 * аудитория), и общих ключей с остальным приложением у него нет.
 */

export const surveyKeys = {
  list: (status?: SurveyStatus) => ['surveys', 'list', status ?? 'ALL'] as const,
  survey: (id: number) => ['surveys', id] as const,
  questions: (id: number) => ['surveys', id, 'questions'] as const,
  stats: (id: number, classId?: number) => ['surveys', id, 'stats', classId ?? 'ALL'] as const,
  respondents: (id: number, classId?: number) => ['surveys', id, 'respondents', classId ?? 'ALL'] as const,
  respondentAnswers: (id: number, recipientId: number) =>
    ['surveys', id, 'respondents', recipientId] as const,
  aiAnalysis: (id: number, scope: SurveyAiScope, classId?: number) =>
    ['surveys', id, 'ai-analysis', scope, classId ?? 'ALL'] as const,
};

export function useSurveys(status?: SurveyStatus) {
  return useQuery({
    queryKey: surveyKeys.list(status),
    queryFn: ({ signal }) => surveyApi.list(status, signal),
  });
}

export function useSurvey(id: number | null) {
  return useQuery({
    queryKey: surveyKeys.survey(id ?? 0),
    queryFn: ({ signal }) => surveyApi.card(id as number, signal),
    enabled: id != null,
  });
}

export function useSurveyQuestions(id: number | null) {
  return useQuery({
    queryKey: surveyKeys.questions(id ?? 0),
    queryFn: ({ signal }) => surveyApi.questions(id as number, signal),
    enabled: id != null,
  });
}

export function useCreateSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSurveyRequest) => surveyApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surveys', 'list'] });
    },
  });
}

export function useUpdateSurvey(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSurveyRequest) => surveyApi.update(id, body),
    onSuccess: (survey) => {
      qc.setQueryData(surveyKeys.survey(id), survey);
      qc.invalidateQueries({ queryKey: ['surveys', 'list'] });
    },
  });
}

/**
 * Вопросы опроса. Ответ — сохранённый список, но `questionCount` карточки он не
 * несёт, поэтому саму карточку перечитываем: иначе кнопка «Опубликовать» ещё один
 * запрос считала бы опрос пустым.
 */
export function useSaveSurveyQuestions(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveSurveyQuestionsRequest) => surveyApi.saveQuestions(id, body),
    onSuccess: (questions) => {
      qc.setQueryData(surveyKeys.questions(id), questions);
      qc.invalidateQueries({ queryKey: surveyKeys.survey(id) });
    },
  });
}

export function useSetSurveyAudience(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetSurveyAudienceRequest) => surveyApi.setAudience(id, body),
    onSuccess: (survey) => {
      qc.setQueryData(surveyKeys.survey(id), survey);
      qc.invalidateQueries({ queryKey: ['surveys', 'list'] });
    },
  });
}

export function usePublishSurvey(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => surveyApi.publish(id),
    onSuccess: (survey) => {
      qc.setQueryData(surveyKeys.survey(id), survey);
      qc.invalidateQueries({ queryKey: ['surveys', 'list'] });
    },
  });
}

export function useEndSurvey(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => surveyApi.end(id),
    onSuccess: (survey) => {
      qc.setQueryData(surveyKeys.survey(id), survey);
      qc.invalidateQueries({ queryKey: ['surveys', 'list'] });
    },
  });
}

/**
 * Результаты. `classId` целиком серверный фильтр (и числитель, и знаменатель) —
 * `placeholderData` только держит прежнюю страницу, пока грузится следующая, а не
 * пересчитывает проценты на клиенте.
 */
export function useSurveyStats(id: number | null, classId?: number) {
  return useQuery({
    queryKey: surveyKeys.stats(id ?? 0, classId),
    queryFn: ({ signal }) => surveyApi.stats(id as number, classId, signal),
    enabled: id != null,
    placeholderData: (previous) => previous,
  });
}

/**
 * Кто ответил — только для именных опросов; на анонимных бэкенд отвечает 409
 * `SURVEY_ANONYMOUS`, и экран эту ветку не запрашивает вовсе (см. `SurveyResultsTab`).
 */
export function useSurveyRespondents(id: number | null, classId?: number) {
  return useQuery({
    queryKey: surveyKeys.respondents(id ?? 0, classId),
    queryFn: ({ signal }) => surveyApi.respondents(id as number, classId, signal),
    enabled: id != null,
  });
}

/** Ответы одного респондента — запрашивается по клику на строку, не заранее. */
export function useSurveyRespondentAnswers(id: number | null, recipientId: number | null) {
  return useQuery({
    queryKey: surveyKeys.respondentAnswers(id ?? 0, recipientId ?? 0),
    queryFn: ({ signal }) => surveyApi.respondentAnswers(id as number, recipientId as number, signal),
    enabled: id != null && recipientId != null,
  });
}

/**
 * Последний посчитанный AI-анализ. `GET` ничего не запускает — опрос идёт, пока задача
 * (`job`) не идущая: `PENDING`/`RUNNING` держат интервал коротким, как у опроса
 * генерации ДЗ (`useLastGradeSuggestion`).
 */
export function useSurveyAiAnalysis(id: number | null, scope: SurveyAiScope, classId?: number) {
  return useQuery({
    queryKey: surveyKeys.aiAnalysis(id ?? 0, scope, classId),
    queryFn: ({ signal }) => surveyApi.aiAnalysis(id as number, scope, classId, signal),
    enabled: id != null && (scope !== 'CLASS' || classId != null),
    refetchInterval: (query) => {
      const status = query.state.data?.job?.status;
      return status === 'PENDING' || status === 'RUNNING' ? 3000 : false;
    },
  });
}

export function useTriggerSurveyAiAnalysis(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scope, classId, key }: { scope: SurveyAiScope; classId?: number; key: string }) =>
      surveyApi.triggerAiAnalysis(id, scope, classId, key),
    onSuccess: (_job, vars) => {
      qc.invalidateQueries({ queryKey: surveyKeys.aiAnalysis(id, vars.scope, vars.classId) });
    },
  });
}
