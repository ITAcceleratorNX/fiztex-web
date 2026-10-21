import { request } from './api';
import type { Schema } from './apiSchemas';

export const schoolYearLifecycleApi = {
  readiness: (id: string, signal?: AbortSignal) => request<Schema<'AcademicYearReadinessView'>>(`/admin/academic-years/${id}/completion-readiness`, { signal }),
  history: (id: string, signal?: AbortSignal) => request<Schema<'AcademicYearLifecycleEventView'>[]>(`/admin/academic-years/${id}/lifecycle-history`, { signal }),
  complete: (id: string) => request<void>(`/admin/academic-years/${id}/archive`, { method: 'POST' }),
  restore: (id: string, body: Schema<'RestoreAcademicYearRequest'>) => request<Schema<'AcademicYearView'>>(`/admin/academic-years/${id}/restore`, { method: 'POST', body }),
};
