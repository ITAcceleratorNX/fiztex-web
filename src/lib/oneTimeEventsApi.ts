import { pageQuery, request } from './api';
import type { Schema } from './apiSchemas';

export type OneTimeEvent = Schema<'OneTimeEventView'>;
export type OneTimeEventOnSchedule = Schema<'RoleScheduleOneTimeEventView'>;
export type OneTimeEventRequest = Schema<'UpdateOneTimeEventRequest'>;

/**
 * Разовые события расписания — контракт `fiztex-back/docs/one-time-schedule-events-contract.md`.
 *
 * Кого событие касается и какие уроки перекрывает, считает бэкенд: клиент только отправляет
 * поля формы и рисует пришедшие `overlaps`.
 */
export const oneTimeEventsApi = {
  /** События класса за неделю с перекрытыми уроками его сетки. */
  classSchedule(classId: number, dateFrom: string, dateTo: string, signal?: AbortSignal) {
    return request<OneTimeEventOnSchedule[]>(
      `/admin/one-time-events/class-schedule${pageQuery({ classId, dateFrom, dateTo })}`,
      { signal },
    );
  },

  /** Карточка: событие и посчитанное влияние (классы, люди, уроки). */
  get(id: number, signal?: AbortSignal) {
    return request<OneTimeEvent>(`/admin/one-time-events/${id}`, { signal });
  },

  create(academicYearId: number, body: OneTimeEventRequest) {
    return request<OneTimeEvent>('/admin/one-time-events', {
      method: 'POST',
      body: { ...body, academicYearId },
    });
  },

  update(id: number, body: OneTimeEventRequest) {
    return request<OneTimeEvent>(`/admin/one-time-events/${id}`, { method: 'PUT', body });
  },

  cancel(id: number) {
    return request<OneTimeEvent>(`/admin/one-time-events/${id}/cancel`, { method: 'POST' });
  },
};

/** Корень ключей кэша: любая запись перечитывает и сетку, и карточки. */
export const ONE_TIME_EVENTS_KEY = ['one-time-events'] as const;
