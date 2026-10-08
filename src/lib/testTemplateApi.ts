import { request } from './api';
import type { Schema } from './apiSchemas';

export type TestTemplateVersion = Schema<'HomeworkTestTemplateVersionView'>;
export type TestTemplateTarget = Schema<'HomeworkTestTemplateTargetState'>;
export type TestTemplateDependencies = Schema<'HomeworkTestTemplateDependencyPreview'>;
export type TestAiRequest = Schema<'HomeworkTestAiGenerateRequest'>;
export type TestAiJob = Schema<'HomeworkTestAiJobView'>;
export type TestAiOverview = Schema<'HomeworkTestAiOverview'>;

const root = '/teacher/workspace/tests';

export const testTemplateApi = {
  subjectContext: (signal?: AbortSignal) => request<Schema<'TeacherTestSubjectContext'>>(`${root}/context`, { signal }),
  aiOverview: (signal?: AbortSignal) =>
    request<TestAiOverview>(`${root}/ai-generations/overview`, { signal }),
  startAi: (body: TestAiRequest, key: string) =>
    request<TestAiJob>(`${root}/ai-generations`, { method: 'POST', headers: { 'Idempotency-Key': key }, body }),
  current: (id: number, signal?: AbortSignal) =>
    request<TestTemplateVersion>(`${root}/${id}`, { signal }),
  create: (body: Schema<'HomeworkTestTemplateSaveRequest'>, key: string) =>
    request<TestTemplateVersion>(root, { method: 'POST', headers: { 'Idempotency-Key': key }, body }),
  createFromQuestions: (body: Schema<'HomeworkTestTemplateCreateFromQuestionsRequest'>, key: string) =>
    request<TestTemplateVersion>(`${root}/from-questions`, { method: 'POST', headers: { 'Idempotency-Key': key }, body }),
  versionFromQuestions: (id: number, body: Schema<'HomeworkTestTemplateVersionFromQuestionsRequest'>, key: string) =>
    request<TestTemplateVersion>(`${root}/${id}/versions/from-questions`, { method: 'POST', headers: { 'Idempotency-Key': key }, body }),
  rename: (id: number, body: Schema<'HomeworkTestTemplateRenameRequest'>) =>
    request<Schema<'HomeworkTestTemplateSummaryView'>>(`${root}/${id}`, { method: 'PATCH', body }),
  dependencies: (id: number, signal?: AbortSignal) =>
    request<TestTemplateDependencies>(`${root}/${id}/dependencies`, { signal }),
  delete: (id: number, dependencies: TestTemplateDependencies) =>
    request<void>(`${root}/${id}?confirmDetach=${(dependencies.activeApplications ?? 0) > 0}`, {
      method: 'DELETE', headers: dependencies.revision ? { 'If-Match': dependencies.revision } : undefined,
    }),
  target: (homeworkId: number, signal?: AbortSignal) =>
    request<TestTemplateTarget>(`/homework/${homeworkId}/test-template`, { signal }),
  apply: (homeworkId: number, body: Schema<'HomeworkTestTemplateApplyRequest'>, key: string) =>
    request<Schema<'HomeworkTestTemplateApplicationView'>>(`/homework/${homeworkId}/test-template`, {
      method: 'POST', headers: { 'Idempotency-Key': key }, body,
    }),
};
