import { pageQuery, request } from './api';
import type { Schema } from './apiSchemas';

export type AccessJournalRow = Schema<'AccessJournalRowView'>;
export type AccessJournalEventType = NonNullable<AccessJournalRow['type']>;

export type AccessJournalFilters = {
  type?: AccessJournalEventType;
  /** Границы суток считает бэкенд, в часовом поясе школы: сюда уходит дата, не момент. */
  from?: string;
  to?: string;
  query?: string;
  accountId?: number;
  requestId?: number;
  page: number;
  size: number;
};

/**
 * Журнал действий с доступом (AUTH-BE-001 §11). Права нового нет: открыт тем, у кого уже
 * есть `ACCESS_REQUEST_REVIEW` или `CREDENTIAL_MANAGE` — журнал ровно про эти две работы.
 */
export const accessJournalApi = {
  list(filters: AccessJournalFilters, signal?: AbortSignal) {
    return request<Schema<'PageAccessJournalRowView'>>(
      `/admin/access-journal${pageQuery(filters)}`,
      { signal },
    );
  },
};
