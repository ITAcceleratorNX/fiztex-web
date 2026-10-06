import { pageQuery, request } from './api';
import type { Schema } from './apiSchemas';

export type LessonPreparationVersion = Schema<'LessonPreparationVersionView'>;
export type LessonPreparationTarget = Schema<'LessonPreparationTargetState'>;
export type PreparationAiRequest = Schema<'LessonPreparationAiGenerateRequest'>;
export type PreparationAiSource = Schema<'LessonPreparationAiSourceView'>;
export type PreparationAiJob = Schema<'LessonPreparationAiJobView'>;
export type PreparationAiOverview = Schema<'LessonPreparationAiOverview'>;
export type PreparationCopyPreview = Schema<'LessonPreparationCopyPreview'>;
export type PreparationCopyContent = Schema<'LessonPreparationCopyContent'>;
export type PreparationCopyResult = Schema<'LessonPreparationCopyResult'>;

const root = '/teacher/lesson-preparations';

export const lessonPreparationApi = {
  current: (id: number, signal?: AbortSignal) =>
    request<LessonPreparationVersion>(`${root}/${id}`, { signal }),
  create: (body: Schema<'LessonPreparationCreateRequest'>) =>
    request<LessonPreparationVersion>(root, { method: 'POST', body }),
  target: (lessonId: number, signal?: AbortSignal) =>
    request<LessonPreparationTarget>(`/lessons/${lessonId}/preparation`, { signal }),
  apply: (lessonId: number, body: Schema<'LessonPreparationApplyRequest'>) =>
    request<Schema<'LessonPreparationApplicationView'>>(`/lessons/${lessonId}/preparation`, { method: 'PUT', body }),
  /** Перенос подготовки урок → урок; адреса — от исходного урока. */
  copyPreview: (sourceLessonId: number, targetLessonId: number, signal?: AbortSignal) =>
    request<PreparationCopyPreview>(`/lessons/${sourceLessonId}/preparation/copy${pageQuery({ targetLessonId })}`, { signal }),
  copy: (sourceLessonId: number, body: Schema<'LessonPreparationCopyRequest'>) =>
    request<PreparationCopyResult>(`/lessons/${sourceLessonId}/preparation/copy`, { method: 'POST', body }),
  aiOverview: (signal?: AbortSignal) =>
    request<PreparationAiOverview>(`${root}/ai-generations/overview`, { signal }),
  aiSource: (sourceType: NonNullable<PreparationAiRequest['sourceType']>, workspaceItemId: number,
    signal?: AbortSignal) =>
    request<PreparationAiSource>(`${root}/ai-source${pageQuery({ sourceType, workspaceItemId })}`, { signal }),
  startAi: (body: PreparationAiRequest, key: string) =>
    request<PreparationAiJob>(`${root}/ai-generations`, {
      method: 'POST', body, headers: { 'Idempotency-Key': key },
    }),
  aiJob: (id: number, signal?: AbortSignal) =>
    request<PreparationAiJob>(`${root}/ai-generations/${id}`, { signal }),
};
