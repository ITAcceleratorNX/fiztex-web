import { request } from './api';
import type { Schema } from './apiSchemas';

export type ParentComment = Schema<'ParentCommentView'>;
export type ParentCommentRow = Schema<'ParentCommentStudentRow'>;
export type ParentCommentSheet = Schema<'LessonParentCommentSheetView'>;
export type PublishParentComment = Schema<'PublishParentCommentRequest'>;

export const parentCommentsApi = {
  sheet: (lessonId: number, signal?: AbortSignal) =>
    request<ParentCommentSheet>(`/lessons/${lessonId}/parent-comments`, { signal }),
  publish: (lessonId: number, studentId: number, body: PublishParentComment) =>
    request<ParentComment>(`/lessons/${lessonId}/parent-comments/students/${studentId}`, { method: 'PUT', body }),
  improve: (lessonId: number, studentId: number, text: string) =>
    request<Schema<'ParentCommentImprovementView'>>(`/lessons/${lessonId}/parent-comments/students/${studentId}/improvement`,
      { method: 'POST', body: { text } }),
};
