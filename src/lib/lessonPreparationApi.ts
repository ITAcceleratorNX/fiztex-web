import { request } from './api';
import type { Schema } from './apiSchemas';

export type LessonPreparationVersion = Schema<'LessonPreparationVersionView'>;
export type LessonPreparationTarget = Schema<'LessonPreparationTargetState'>;

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
};
