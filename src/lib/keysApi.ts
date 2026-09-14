import { pageQuery, request } from './api';
import type { Schema } from './apiSchemas';

export type KeyDashboardState = 'ON_POST' | 'ISSUED';

export type KeyDashboardFilters = {
  state: KeyDashboardState;
  query?: string;
  hasProblem?: boolean;
  holderInactive?: boolean;
};

export type KeyHistoryFilters = {
  action?: string;
  page: number;
  size: number;
};

/** Read-only client for the Super Admin keys screen. Mutations live in the security app. */
export const keysApi = {
  dashboard(filters: KeyDashboardFilters, signal?: AbortSignal) {
    return request<Schema<'KeyDashboardView'>>(`/keys/dashboard${pageQuery(filters)}`, { signal });
  },

  history(filters: KeyHistoryFilters, signal?: AbortSignal) {
    // Do not pass `sort`: the controller default is the required stable
    // `createdAt DESC, id DESC`; overriding it would lose the id tie-breaker.
    return request<Schema<'PageKeyEventView'>>(`/keys/history${pageQuery(filters)}`, { signal });
  },
};
