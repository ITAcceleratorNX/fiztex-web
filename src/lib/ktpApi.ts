import { pageQuery, request, requestBlob, requestMultipart } from './api';
import type { Schema } from './apiSchemas';
import type { paths } from './api-types';

export type KtpImport = Schema<'KtpImportView'>;
export type KtpDraft = Schema<'KtpDraftView'>;
export type KtpContent = Schema<'ParsedKtp'>;
export type KtpTopic = Schema<'ParsedKtpTopic'>;
export type KtpTeaching = Schema<'KtpLessonTeachingTopic'>;
export type KtpChange = Schema<'KtpTeachingChange'>;
export type KtpReadScope = 'teacher' | 'admin';
export type KtpProgress = Schema<'KtpProgress'>;
export type KtpBinding = Schema<'KtpBindingView'>;
export type KtpListFilters = Omit<NonNullable<paths['/api/teacher/ktp/imports']['get']['parameters']['query']>, 'cursor' | 'limit'>;
/** UI selection; request bodies below use generated API schemas. */
export type KtpRemovalTarget = { kind: 'import'; id: number; label: string }
  | { kind: 'version'; bindingId: number; versionId: number; label: string }
  | { kind: 'plan'; targets: Schema<'KtpBindingRemovalTarget'>[]; label: string };
const root = '/teacher/ktp';
const command = <T>(path: string, body: unknown, key: string) => request<T>(path, { method: 'POST', body, headers: { 'Idempotency-Key': key } });
export const ktpApi = {
  context: (signal?: AbortSignal) => request<Schema<'KtpContext'>>(`${root}/context`, { signal }),
  imports: (cursor?: number, signal?: AbortSignal, filters: KtpListFilters = {}) => request<Schema<'KtpImportPage'>>(`${root}/imports${pageQuery({ ...filters, cursor, limit: 20 })}`, { signal }),
  drafts: (cursor?: number, signal?: AbortSignal) => request<Schema<'KtpDraftPage'>>(`${root}/drafts${pageQuery({ cursor, limit: 100 })}`, { signal }),
  bindings: (cursor?: number, signal?: AbortSignal, filters: KtpListFilters = {}) => request<Schema<'KtpBindingPage'>>(`${root}/bindings${pageQuery({ academicYearId: filters.academicYearId, subjectId: filters.subjectId, classId: filters.classId, status: filters.status, cursor, limit: 100 })}`, { signal }),
  import: (id: number, signal?: AbortSignal) => request<KtpImport>(`${root}/imports/${id}`, { signal }),
  upload: (input: { file: File; context: Schema<'KtpUploadContext'> }, key: string) => {
    const data = new FormData();
    data.append('context', new Blob([JSON.stringify(input.context)], { type: 'application/json' }));
    data.append('file', input.file);
    return requestMultipart<KtpImport>(`${root}/imports`, data, undefined, { 'Idempotency-Key': key });
  },
  start: (input: { id: number; body: Schema<'KtpStartRequest'> }, key: string) => command<Schema<'KtpJobView'>>(`${root}/imports/${input.id}/processing`, input.body, key),
  manual: (input: { id: number; body: Schema<'KtpRevisionRequest'> }, key: string) => command<Schema<'KtpDraftReceipt'>>(`${root}/imports/${input.id}/draft`, input.body, key),
  job: (id: number, signal?: AbortSignal) => request<Schema<'KtpJobView'>>(`${root}/jobs/${id}`, { signal }),
  diagnostics: (id: number, cursor?: number, signal?: AbortSignal) => request<Schema<'KtpDiagnosticPage'>>(`${root}/jobs/${id}/diagnostics${pageQuery({ cursor, limit: 100 })}`, { signal }),
  draft: (id: number, signal?: AbortSignal) => request<KtpDraft>(`${root}/drafts/${id}`, { signal }),
  reparse: (input: { id: number; body: Schema<'KtpStartRequest'> }, key: string) => command<Schema<'KtpJobView'>>(`${root}/drafts/${input.id}/parse-preview`, input.body, key),
  parsePreview: (id: number, jobId: number, signal?: AbortSignal) => request<Schema<'KtpParsePreview'>>(`${root}/drafts/${id}/parse-previews/${jobId}`, { signal }),
  applyParsePreview: (input: { id: number; jobId: number; body: Schema<'KtpRevisionRequest'> }, key: string) => command<Schema<'KtpDraftReceipt'>>(`${root}/drafts/${input.id}/parse-previews/${input.jobId}/apply`, input.body, key),
  save: (input: { id: number; body: Schema<'KtpDraftUpdate'> }) => request<KtpDraft>(`${root}/drafts/${input.id}`, { method: 'PUT', body: input.body }),
  activation: (id: number, signal?: AbortSignal) => request<Schema<'KtpActivationPreview'>>(`${root}/drafts/${id}/activation-preview`, { signal }),
  confirm: (input: { id: number; body: Schema<'KtpConfirmRequest'> }, key: string) => command<Schema<'KtpConfirmation'>>(`${root}/drafts/${input.id}/confirm`, input.body, key),
  binding: (id: number, signal?: AbortSignal) => request<KtpBinding>(`${root}/bindings/${id}`, { signal }),
  progress: (id: number, signal?: AbortSignal) => request<KtpProgress>(`${root}/bindings/${id}/progress`, { signal }),
  distribution: (id: number, signal?: AbortSignal) => request<Schema<'KtpDistribution'>>(`${root}/bindings/${id}/distribution`, { signal }),
  reconcile: (input: { id: number; body: Schema<'KtpRevisionRequest'> }, key: string) => command<Schema<'ReconcileReceipt'>>(`${root}/bindings/${input.id}/distribution/reconcile`, input.body, key),
  initialPreview: (id: number, signal?: AbortSignal) => request<Schema<'KtpInitialSyncPreview'>>(`${root}/bindings/${id}/initial-sync-preview`, { signal }),
  initialSync: (input: { id: number; body: Schema<'KtpInitialSyncRequest'> }, key: string) => command<Schema<'KtpProgressReceipt'>>(`${root}/bindings/${input.id}/initial-sync`, input.body, key),
  historicalPreview: (input: { id: number; body: Schema<'KtpHistoricalLinkRequest'> }) => request<Schema<'KtpHistoricalLinkPreview'>>(`${root}/bindings/${input.id}/historical-link-preview`, { method: 'POST', body: input.body }),
  historicalLink: (input: { id: number; body: Schema<'KtpHistoricalLinkConfirmation'> }, key: string) => command<Schema<'KtpProgressReceipt'>>(`${root}/bindings/${input.id}/historical-links`, input.body, key),
  adjustment: (input: { id: number; topicId: number; body: Schema<'KtpTopicAdjustmentRequest'> }, key: string) => command<Schema<'KtpProgressReceipt'>>(`${root}/bindings/${input.id}/topics/${input.topicId}/adjustments`, input.body, key),
  history: (id: number, cursor?: number, signal?: AbortSignal) => request<Schema<'KtpActivationPage'>>(`${root}/bindings/${id}/history${pageQuery({ cursor, limit: 30 })}`, { signal }),
  version: (id: number, versionId: number, signal?: AbortSignal) => request<Schema<'KtpVersionView'>>(`${root}/bindings/${id}/versions/${versionId}`, { signal }),
  transition: (id: number, signal?: AbortSignal) => request<Schema<'KtpVersionTransition'>>(`${root}/bindings/${id}/version-transition`, { signal }),
  versionPreview: (input: { id: number; body: Schema<'KtpVersionSyncRequest'> }) => request<Schema<'KtpVersionSyncPreview'>>(`${root}/bindings/${input.id}/version-sync-preview`, { method: 'POST', body: input.body }),
  versionSync: (input: { id: number; body: Schema<'KtpVersionSyncConfirmation'> }, key: string) => command<Schema<'KtpProgressReceipt'>>(`${root}/bindings/${input.id}/version-sync`, input.body, key),
  teaching: (id: number, signal?: AbortSignal, scope: KtpReadScope = 'teacher') => request<KtpTeaching>(`${scope === 'admin' ? '/admin' : ''}/lessons/${id}/teaching-topic`, { signal }),
  teachingHistory: (id: number, cursor?: number, signal?: AbortSignal, scope: KtpReadScope = 'teacher') => request<Schema<'KtpTeachingAuditPage'>>(`${scope === 'admin' ? '/admin' : ''}/lessons/${id}/teaching-topic/history${pageQuery({ cursor, limit: 30 })}`, { signal }),
  teachingPreview: (input: { id: number; body: KtpChange }) => request<Schema<'KtpTeachingPreview'>>(`/lessons/${input.id}/teaching-topic/preview`, { method: 'POST', body: input.body }),
  teachingChange: (input: { id: number; body: Schema<'KtpTeachingConfirmation'> }, key: string) => command<Schema<'KtpTeachingReceipt'>>(`/lessons/${input.id}/teaching-topic`, input.body, key),
  source: (input: { importId: number } | { bindingId: number; versionId: number }) => requestBlob('importId' in input ? `${root}/imports/${input.importId}/source` : `${root}/bindings/${input.bindingId}/versions/${input.versionId}/source`),
  removalPreview: (target: KtpRemovalTarget, signal?: AbortSignal) => target.kind === 'plan'
    ? request<Schema<'KtpRemovalPreview'>>(`${root}/bindings/removal-preview`, { method: 'POST', body: { targets: target.targets } satisfies Schema<'KtpBindingRemovalTargets'>, signal })
    : request<Schema<'KtpRemovalPreview'>>(target.kind === 'import' ? `${root}/imports/${target.id}/removal-preview` : `${root}/bindings/${target.bindingId}/versions/${target.versionId}/removal-preview`, { signal }),
  remove: ({ target, preview }: { target: KtpRemovalTarget; preview: Schema<'KtpRemovalPreview'> }, key: string) => {
    if (target.kind === 'plan') return command<Schema<'KtpRemovalReceipt'>>(`${root}/bindings/remove`, { targets: target.targets, previewFingerprint: preview.previewFingerprint } satisfies Schema<'KtpBindingRemovalRequest'>, key);
    const body: Schema<'KtpRemovalRequest'> = { expectedRevision: preview.revision, previewFingerprint: preview.previewFingerprint };
    return request<Schema<'KtpRemovalReceipt'>>(target.kind === 'import' ? `${root}/imports/${target.id}` : `${root}/bindings/${target.bindingId}/versions/${target.versionId}`, { method: 'DELETE', body, headers: { 'Idempotency-Key': key } });
  },
};
