import { request } from './api';
import type { Schema } from './apiSchemas';

export type TestTemplateVersion = Schema<'HomeworkTestTemplateVersionView'>;
export type TestTemplateTarget = Schema<'HomeworkTestTemplateTargetState'>;

const root = '/teacher/workspace/tests';

export const testTemplateApi = {
  current: (id: number, signal?: AbortSignal) =>
    request<TestTemplateVersion>(`${root}/${id}`, { signal }),
  create: (body: Schema<'HomeworkTestTemplateSaveRequest'>, key: string) =>
    request<TestTemplateVersion>(root, { method: 'POST', headers: { 'Idempotency-Key': key }, body }),
  target: (homeworkId: number, signal?: AbortSignal) =>
    request<TestTemplateTarget>(`/homework/${homeworkId}/test-template`, { signal }),
  apply: (homeworkId: number, body: Schema<'HomeworkTestTemplateApplyRequest'>, key: string) =>
    request<Schema<'HomeworkTestTemplateApplicationView'>>(`/homework/${homeworkId}/test-template`, {
      method: 'POST', headers: { 'Idempotency-Key': key }, body,
    }),
};
