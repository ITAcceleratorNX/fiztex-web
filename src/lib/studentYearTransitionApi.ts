import { request } from './api';
import type { Schema } from './apiSchemas';
export const studentYearTransitionApi = {
 preview: (id: string, signal?: AbortSignal) => request<Schema<'StudentYearTransitionView'>>(`/admin/classes/${id}/year-transition`, { signal }),
 apply: (id: string, body: Schema<'StudentYearDecisionRequest'>) => request<Schema<'StudentYearTransitionView'>>(`/admin/classes/${id}/year-transition`, { method: 'POST', body }),
 history: (id: string, signal?: AbortSignal) => request<Schema<'StudentYearDecision'>[]>(`/admin/students/${id}/year-decisions`, { signal }),
 cancellationPreview: (id: number, signal?: AbortSignal) => request<Schema<'StudentYearDecisionCancellationView'>>(`/admin/student-year-decisions/${id}/cancellation-preview`, { signal }),
 cancel: (id: number, body: Schema<'StudentYearDecisionCancellationRequest'>) => request<Schema<'StudentYearDecisionCancellationView'>>(`/admin/student-year-decisions/${id}/cancel`, { method: 'POST', body }),
 classHistory: (classId: number, signal?: AbortSignal) => request<Schema<'StudentYearDecision'>[]>(`/my-class/classes/${classId}/student-year-decisions`, { signal }),
};
