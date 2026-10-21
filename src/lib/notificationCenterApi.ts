import { request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

/**
 * Центр уведомлений аккаунта (`NotificationCenterController`, `fiztex-back/docs/notification-contract.md`).
 *
 * Аккаунт — из токена: адрес без идентификатора, чужой ленты нет в принципе. В панели ленту читает учитель
 * (ТЗ «Внутренние уведомления — Teacher»); у ученика и родителя она в мобилке.
 */

export type CenterItem = Schema<'NotificationCenterItemView'>;
export type CenterPage = Schema<'NotificationCenterPageView'>;

export const notificationCenterApi = {
  page: (signal?: AbortSignal) => request<CenterPage>('/notifications?limit=30', { signal }),
  unread: (signal?: AbortSignal) => request<Schema<'NotificationCenterUnreadView'>>('/notifications/unread-count', { signal }),
  markRead: (id: string) => request<void>(`/notifications/${id}/read`, { method: 'POST' }),
  /** `upTo` — время самой новой показанной строки: пришедшее, пока человек нажимал, прочитанным не становится. */
  markAllRead: (upTo?: string) =>
    request<void>(`/notifications/read-all${upTo ? `?upTo=${encodeURIComponent(upTo)}` : ''}`, { method: 'POST' }),
};
