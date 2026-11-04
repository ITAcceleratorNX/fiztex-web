import { pageQuery, request } from './api';
import type { Schema } from './apiSchemas';

export type AccessRequestStage = NonNullable<Schema<'AccessRequestRowView'>['stage']>;
export type AccessRequestRole = NonNullable<Schema<'AccessRequestRowView'>['role']>;

export type AccessRequestFilters = {
  stage: AccessRequestStage;
  role?: AccessRequestRole;
  query?: string;
  page: number;
  size: number;
};

/**
 * Реестр заявок на доступ (AUTH-BE-001 §4, право `ACCESS_REQUEST_REVIEW`).
 *
 * Отбор идёт по вычисляемому `stage`, а не по хранимому статусу, и `stage` у запроса
 * ровно один: «одобрена» на бэкенде — это два разных этапа, `APPROVED_PENDING_ACTIVATION`
 * и `ACTIVE`. Склеивать их на клиенте двумя запросами нельзя — развалилась бы страница.
 */
export const accessRequestsApi = {
  list(filters: AccessRequestFilters, signal?: AbortSignal) {
    return request<Schema<'PageAccessRequestRowView'>>(
      `/admin/access-requests${pageQuery(filters)}`,
      { signal },
    );
  },

  stats(signal?: AbortSignal) {
    return request<Schema<'AccessRequestStatsView'>>('/admin/access-requests/stats', { signal });
  },

  detail(requestId: number, signal?: AbortSignal) {
    return request<Schema<'AccessRequestDetailView'>>(
      `/admin/access-requests/${requestId}`,
      { signal },
    );
  },

  suggestions(requestId: number, signal?: AbortSignal) {
    return request<Schema<'AccessRequestSuggestionsView'>>(
      `/admin/access-requests/${requestId}/suggestions`,
      { signal },
    );
  },

  approve(requestId: number, body: Schema<'ApproveAccessRequestRequest'>) {
    return request<Schema<'AccessRequestDetailView'>>(
      `/admin/access-requests/${requestId}/approve`,
      { method: 'POST', body },
    );
  },

  reject(requestId: number, body: Schema<'RejectAccessRequestRequest'>) {
    return request<Schema<'AccessRequestDetailView'>>(
      `/admin/access-requests/${requestId}/reject`,
      { method: 'POST', body },
    );
  },
};
