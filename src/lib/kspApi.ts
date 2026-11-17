import { request, requestBlob } from './api';
import type { Schema } from './apiSchemas';

/**
 * КСП по приказу №130 — клиент `/api/lessons/{id}/ksp` (контракт `fiztex-back/docs/ksp-contract.md`).
 *
 * Только учитель урока: остальным роли бэкенд отвечает 403, поэтому экраны спрашивают
 * КСП лишь у того, у кого на уроке есть `VIEW_TEACHER_HISTORY`.
 */
export type KspContext = Schema<'KspContextView'>;
export type KspView = Schema<'KspView'>;
export type KspDocument = Schema<'KspDocument'>;
export type KspStage = Schema<'KspStage'>;
export type KspJob = Schema<'KspJobView'>;
export type KspJobSource = Schema<'KspJobSource'>;
export type KspGenerateRequest = Schema<'KspGenerateRequest'>;
export type KspSaveRequest = Schema<'KspSaveRequest'>;
export type KspTopicSource = Schema<'KspTopicSource'>;
export type KspState = Schema<'KspState'>;
export type KspEntryState = NonNullable<KspContext['entryState']>;
export type KspExportFormat = 'docx' | 'pdf';

const path = (lessonId: number) => `/lessons/${lessonId}/ksp`;

export const kspApi = {
  context: (lessonId: number, signal?: AbortSignal) =>
    request<KspContext>(`${path(lessonId)}/context`, { signal }),
  get: (lessonId: number, signal?: AbortSignal) => request<KspView>(path(lessonId), { signal }),
  /** `key` — новый UUID на каждое нажатие «Сохранить», тот же — на повтор той же отправки. */
  save: (lessonId: number, key: string, body: KspSaveRequest) =>
    request<KspView>(path(lessonId), { method: 'PUT', body, headers: { 'Idempotency-Key': key } }),
  start: (lessonId: number, key: string, body: KspGenerateRequest) =>
    request<KspJob>(`${path(lessonId)}/generations`, {
      method: 'POST', body, headers: { 'Idempotency-Key': key },
    }),
  job: (lessonId: number, jobId: number, signal?: AbortSignal) =>
    request<KspJob>(`${path(lessonId)}/generations/${jobId}`, { signal }),
  dismiss: (lessonId: number, jobId: number) =>
    request<KspJob>(`${path(lessonId)}/generations/${jobId}/dismiss`, { method: 'POST' }),
  export: (lessonId: number, format: KspExportFormat) =>
    requestBlob(`${path(lessonId)}/export?format=${format}`),
};

export const kspJobRunning = (job?: KspJob | null) => job?.status === 'PENDING' || job?.status === 'RUNNING';
