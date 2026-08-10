import { pageQuery, request } from './api';
import type { Schema } from './apiSchemas';

export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN';

export type Announcement = Schema<'AnnouncementView'>;
export type AnnouncementListItem = Schema<'AnnouncementListItem'>;
export type AnnouncementRequest = Schema<'AnnouncementRequest'>;
export type AnnouncementPage = Schema<'PageAnnouncementListItem'>;
export type PublicAnnouncementItem = Schema<'PublicAnnouncementItem'>;
export type PublicAnnouncement = Schema<'PublicAnnouncementView'>;

export interface AnnouncementFilters {
  status?: AnnouncementStatus | '';
  grade?: string;
  page?: number;
  size?: number;
}

/**
 * Клиент раздела анонсов (ТЗ «Анонсы вступительных тестов»).
 *
 * <p>Публичные вызовы идут через тот же {@link request}, что и админские: он
 * подставляет токен, только если тот есть, а публичные эндпоинты его не требуют.
 * Отдельный клиент ради этого заводить незачем.
 *
 * <p>Статус меняют `publish`/`hide`, а не `update`: на бэкенде это разные действия
 * со своими правилами перехода, и клиент повторяет ту же границу.
 */
export const announcementsApi = {
  // --- Публичный раздел (§4): без входа и без персонального кода ---
  listPublic: (grade?: string, signal?: AbortSignal) =>
    request<PublicAnnouncementItem[]>(
      `/admissions/announcements${pageQuery({ grade })}`,
      { signal },
    ),

  publicGrades: (signal?: AbortSignal) =>
    request<string[]>('/admissions/announcements/grades', { signal }),

  getPublic: (id: number, signal?: AbortSignal) =>
    request<PublicAnnouncement>(`/admissions/announcements/${id}`, { signal }),

  // --- Администрирование (§3) ---
  list: (filters: AnnouncementFilters, signal?: AbortSignal) =>
    request<AnnouncementPage>(
      `/admin/admissions/announcements${pageQuery({
        status: filters.status || undefined,
        grade: filters.grade || undefined,
        page: filters.page,
        size: filters.size,
      })}`,
      { signal },
    ),

  get: (id: number, signal?: AbortSignal) =>
    request<Announcement>(`/admin/admissions/announcements/${id}`, { signal }),

  create: (body: AnnouncementRequest) =>
    request<Announcement>('/admin/admissions/announcements', { method: 'POST', body }),

  update: (id: number, body: AnnouncementRequest) =>
    request<Announcement>(`/admin/admissions/announcements/${id}`, { method: 'PUT', body }),

  publish: (id: number) =>
    request<Announcement>(`/admin/admissions/announcements/${id}/publish`, { method: 'POST' }),

  hide: (id: number) =>
    request<Announcement>(`/admin/admissions/announcements/${id}/hide`, { method: 'POST' }),
};
