import { request, requestMultipart } from './api';
import type { Schema } from './apiSchemas';

export type LessonSummary = Schema<'LessonSummaryView'>;
export type SummaryContent = Schema<'LessonSummaryContent'>;
export type SummaryJob = Schema<'LessonSummaryJobView'>;
export type SummarySource = Schema<'LessonSummarySourceView'>;
export type SummaryGeneration = Schema<'StartLessonSummaryGenerationRequest'>;
export type SummarySave = Schema<'SaveLessonSummaryRequest'>;

const path = (id: number) => '/lessons/' + id + '/summary';

export const lessonSummaryApi = {
  get: (id: number, childId?: number, signal?: AbortSignal) =>
    request<LessonSummary>(path(id) + (childId ? '?childId=' + childId : ''), { signal }),
  save: (id: number, body: SummarySave) =>
    request<LessonSummary>(path(id), { method: 'PUT', body }),
  publish: (id: number, revision: number) =>
    request<LessonSummary>(path(id) + '/publish', { method: 'POST', body: { revision } }),
  unpublish: (id: number, revision: number) =>
    request<LessonSummary>(path(id) + '/unpublish', { method: 'POST', body: { revision } }),
  start: (id: number, key: string, body: SummaryGeneration) =>
    request<SummaryJob>(path(id) + '/ai-generations', {
      method: 'POST', body, headers: { 'Idempotency-Key': key },
    }),
  source: (id: number, type: SummaryGeneration['sourceType'], sourceId: number, signal?: AbortSignal) =>
    request<SummarySource>(path(id) + '/source?sourceType=' + type + '&sourceId=' + sourceId, { signal }),
  library: (subjectId: number, query: string, page: number, signal?: AbortSignal) =>
    request<Schema<'PageTextbookView'>>('/teacher/textbooks?' + new URLSearchParams({
      subjectId: String(subjectId), status: 'ACTIVE', query, page: String(page), size: '30',
    }), { signal }),
  upload: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('visibleToStudents', 'false');
    return requestMultipart<Schema<'LessonMaterialView'>>('/lessons/' + id + '/materials/files', form);
  },
};

export const summaryRunning = (job?: SummaryJob | null) => job?.status === 'PENDING' || job?.status === 'RUNNING';
