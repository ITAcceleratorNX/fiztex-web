import { request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

/**
 * AI-шпаргалка к уроку (LESSON-AI-001): краткий конспект и план урока по материалам,
 * учебнику урока и теме. Контракт — `fiztex-back/docs/lesson-ai-notes-contract.md`.
 *
 * Генерация асинхронная: `start` отвечает сразу строкой в `PENDING`, экран опрашивает
 * `latest`, пока она не закончится. Повторный `start` того же вида во время генерации
 * возвращает её же — двойной клик второй раз модель не зовёт.
 */

export type LessonAiNote = Schema<'LessonAiNoteView'>;
export type LessonAiNoteKind = NonNullable<LessonAiNote['kind']>;
export type StartLessonAiNoteRequest = Schema<'StartLessonAiNoteRequest'>;

export const lessonAiNotesApi = {
  latest: (lessonId: number, signal?: AbortSignal) =>
    request<LessonAiNote[]>(`/lessons/${lessonId}/ai-notes`, { signal }),

  start: (lessonId: number, input: StartLessonAiNoteRequest) =>
    request<LessonAiNote>(`/lessons/${lessonId}/ai-notes`, { method: 'POST', body: input }),
};

export function isNoteActive(note: LessonAiNote | undefined): boolean {
  return note?.status === 'PENDING' || note?.status === 'RUNNING';
}
