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
export type CenterCollections = Schema<'NotificationCollectionsView'>;
export type CenterCollection = Schema<'NotificationCollectionView'>;

export const notificationCenterApi = {
  /** `collection` — одна подборка колокольчика; без неё — вся лента. */
  page: (signal?: AbortSignal, collection?: string | null) =>
    request<CenterPage>(`/notifications?limit=30${collection ? `&collection=${encodeURIComponent(collection)}` : ''}`, { signal }),
  /** Первый экран колокольчика: подборки с последней строкой и непрочитанным (Figma «Уведомления по подборкам»). */
  collections: (signal?: AbortSignal) => request<CenterCollections>('/notifications/collections', { signal }),
  unread: (signal?: AbortSignal) => request<Schema<'NotificationCenterUnreadView'>>('/notifications/unread-count', { signal }),
  markRead: (id: string) => request<void>(`/notifications/${id}/read`, { method: 'POST' }),
  /** `upTo` — время самой новой показанной строки: пришедшее, пока человек нажимал, прочитанным не становится. */
  markAllRead: (upTo?: string, collection?: string | null) => {
    const query = new URLSearchParams();
    if (upTo) query.set('upTo', upTo);
    if (collection) query.set('collection', collection);
    const search = query.toString();
    return request<void>(`/notifications/read-all${search ? `?${search}` : ''}`, { method: 'POST' });
  },
};
