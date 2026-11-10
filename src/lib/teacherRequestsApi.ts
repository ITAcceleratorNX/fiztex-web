import { pageQuery, request, requestBlob, requestMultipart } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type TeacherRequest = Schema<'TeacherRequestView'>;
export type TeacherRequestSummary = Schema<'TeacherRequestSummaryView'>;
export type TeacherRequestDocument = Schema<'TeacherRequestDocumentView'>;
export type TeacherRequestHistory = Schema<'TeacherRequestHistoryEntryView'>;
export type TeacherRequestStatus = NonNullable<TeacherRequest['status']>;
export type TeacherRequestType = NonNullable<TeacherRequest['type']>;
export type TeacherRequestPage = Schema<'PageTeacherRequestSummaryView'>;

export interface TeacherRequestInput {
  type: TeacherRequestType;
  dateFrom: string;
  dateTo: string;
  reason: string;
}

export const TEACHER_REQUEST_PAGE_SIZE = 50;
export const TEACHER_REQUEST_FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/jpeg,image/png,image/heic';
export const TEACHER_REQUEST_MAX_FILE_SIZE = 10 * 1024 * 1024;

export const TEACHER_REQUEST_STATUS: Record<TeacherRequestStatus, string> = {
  PENDING: 'На рассмотрении',
  APPROVED: 'Согласована',
  REJECTED: 'Отклонена',
  CANCELLED: 'Отменена',
};

export const TEACHER_REQUEST_TYPE: Record<TeacherRequestType, string> = {
  RELEASE: 'Освобождение',
  SICK_LEAVE: 'Больничный',
};

export const teacherRequestsApi = {
  teacherList(status?: TeacherRequestStatus, page = 0, signal?: AbortSignal) {
    return request<TeacherRequestPage>(`/teacher/requests${pageQuery({ status, page, size: TEACHER_REQUEST_PAGE_SIZE })}`, { signal });
  },
  teacherOne(id: number, signal?: AbortSignal) {
    return request<TeacherRequest>(`/teacher/requests/${id}`, { signal });
  },
  create(input: TeacherRequestInput) {
    return request<TeacherRequest>('/teacher/requests', { method: 'POST', body: input });
  },
  update(id: number, input: TeacherRequestInput) {
    return request<TeacherRequest>(`/teacher/requests/${id}`, { method: 'PATCH', body: input });
  },
  cancel(id: number) {
    return request<TeacherRequest>(`/teacher/requests/${id}/cancel`, { method: 'POST' });
  },
  upload(id: number, file: File) {
    const body = new FormData();
    body.append('file', file);
    return requestMultipart<TeacherRequestDocument>(`/teacher/requests/${id}/documents`, body);
  },
  removeDocument(requestId: number, documentId: number) {
    return request<void>(`/teacher/requests/${requestId}/documents/${documentId}`, { method: 'DELETE' });
  },
  teacherDocument(requestId: number, documentId: number, signal?: AbortSignal) {
    return requestBlob(`/teacher/requests/${requestId}/documents/${documentId}/content`, signal);
  },
  adminList(status?: TeacherRequestStatus, page = 0, signal?: AbortSignal) {
    return request<TeacherRequestPage>(`/admin/teacher-requests${pageQuery({ status, page, size: TEACHER_REQUEST_PAGE_SIZE })}`, { signal });
  },
  adminOne(id: number, signal?: AbortSignal) {
    return request<TeacherRequest>(`/admin/teacher-requests/${id}`, { signal });
  },
  approve(id: number) {
    return request<TeacherRequest>(`/admin/teacher-requests/${id}/approve`, { method: 'POST' });
  },
  reject(id: number, rejectionReason: string) {
    return request<TeacherRequest>(`/admin/teacher-requests/${id}/reject`, {
      method: 'POST',
      body: { rejectionReason },
    });
  },
  adminDocument(requestId: number, documentId: number, signal?: AbortSignal) {
    return requestBlob(`/admin/teacher-requests/${requestId}/documents/${documentId}/content`, signal);
  },
};

export function isSupportedTeacherRequestFile(file: File): boolean {
  return file.size <= TEACHER_REQUEST_MAX_FILE_SIZE
    && /\.(pdf|jpe?g|png|heic)$/i.test(file.name);
}
