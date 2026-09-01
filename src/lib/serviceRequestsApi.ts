import { pageQuery, request, requestBlob, requestMultipart } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type ServiceRequest = Schema<'ServiceRequestView'>;
export type ServiceRequestPhoto = Schema<'ServiceRequestPhotoView'>;
export type ServiceRequestHistoryEntry = Schema<'ServiceRequestHistoryEntryView'>;

export type ServiceRequestStatus = NonNullable<ServiceRequest['status']>;
export type ServiceType = NonNullable<ServiceRequest['serviceType']>;
export type ServiceRequestAction = NonNullable<ServiceRequestHistoryEntry['action']>;

type ServiceRequestPage = Schema<'PageServiceRequestView'>;

/** Раздел списка (ТЗ SERVICE-FE-001 §3). Наборы не пересекаются: заявка всегда в одном. */
export type ServiceSection = 'ACTIVE' | 'HISTORY';

export const SECTION_STATUSES: Record<ServiceSection, ServiceRequestStatus[]> = {
  ACTIVE: ['NEW', 'IN_PROGRESS'],
  HISTORY: ['COMPLETED', 'CANCELLED'],
};

/** §8: окно возврата выполненной заявки. То же значение, что у бэкенда (BE-006 §1). */
export const RETURN_WINDOW_MS = 48 * 60 * 60 * 1000;

/** §4: лимиты полей — те же, что проверяет `ServiceRequestValidator`. */
export const FIELD_LIMITS = {
  buildingText: 50,
  floorText: 30,
  locationText: 80,
  description: 1000,
} as const;

/** §4: до трёх фотографий, до 10 MB каждая (`ServiceRequestPhotoPolicy`). */
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/**
 * Форматы снимков. Отбор по расширению, а не по заявленному MIME: браузер регулярно
 * отдаёт HEIC как `application/octet-stream`, и проверка по типу отклоняла бы годный файл.
 */
export const PHOTO_EXTENSIONS = /\.(jpe?g|png|heic|heif)$/i;

/** Коды отказов, на которые у экрана есть свой ответ. */
export const SERVICE_REQUEST_ERRORS = {
  validation: 'SERVICE_REQUEST_VALIDATION_FAILED',
  statusConflict: 'SERVICE_REQUEST_STATUS_CONFLICT',
  returnWindowExpired: 'SERVICE_REQUEST_RETURN_WINDOW_EXPIRED',
  forbidden: 'SERVICE_REQUEST_FORBIDDEN',
  notFound: 'SERVICE_REQUEST_NOT_FOUND',
} as const;

export interface CreateServiceRequestInput {
  serviceType: ServiceType;
  emergency: boolean;
  buildingText: string;
  floorText: string;
  locationText: string;
  description: string;
  photos?: File[];
}

/**
 * Сервисные заявки — сценарий автора (ТЗ SERVICE-FE-001, бэкенд SERVICE-BE-002…006).
 *
 * Здесь только то, что делает автор: завести заявку, посмотреть свои, отменить новую и
 * вернуть выполненную. Исполнительских путей (`/queue`, `/claim`, `/complete`,
 * `/transfer`, `/return-to-queue`) в этом объекте нет вовсе — не закомментированы, а
 * отсутствуют: §12 выносит их из задачи, и держать их доступными раньше значило бы
 * позволить экрану автора вызвать чужое действие.
 *
 * `PUT`/`PATCH`/`DELETE` нет и на бэкенде: содержание заявки после создания неизменяемо
 * (§10), а «удаление» — это отмена, оставляющая запись в базе.
 */
/**
 * Свой профиль — нужен ровно ради `accountId`: по нему экран решает, автор ли смотрящий,
 * и показывать ли ему «Удалить» и «Вернуть в работу» (§7).
 *
 * В сессии панели этого поля нет: `Admin` из localStorage хранит токен, имя и роль, но не
 * идентификатор аккаунта. Спрашивать его у бэкенда честнее, чем разбирать JWT на клиенте.
 */
export const meApi = {
  profile(signal?: AbortSignal): Promise<Schema<'MyProfileView'>> {
    return request<Schema<'MyProfileView'>>('/me/profile', { signal });
  },
};

export const serviceRequestsApi = {
  /**
   * Свои заявки (BE-002 §5.2).
   *
   * `status` обязателен для разделов экрана, хотя бэкенд разрешает его опустить: страница
   * это срез, и смешанная выдача из двадцати последних заявок могла бы целиком состоять
   * из выполненных — «Мои заявки» показали бы «пусто» при живых новых на следующей
   * странице. Раздел поэтому грузится по статусу, а не разбором общей выдачи.
   */
  my(
    params: { status?: ServiceRequestStatus; page?: number; size?: number } = {},
    signal?: AbortSignal,
  ): Promise<ServiceRequestPage> {
    return request<ServiceRequestPage>(`/service-requests/my${pageQuery(params)}`, { signal });
  },

  one(id: number, signal?: AbortSignal): Promise<ServiceRequest> {
    return request<ServiceRequest>(`/service-requests/${id}`, { signal });
  },

  /** Лента событий (BE-005 §5). Read-only хронология — поля ввода у неё нет (§10). */
  history(id: number, signal?: AbortSignal): Promise<ServiceRequestHistoryEntry[]> {
    return request<ServiceRequestHistoryEntry[]>(`/service-requests/${id}/history`, { signal });
  },

  /**
   * Создание заявки (BE-002 §5.1, BE-005 §3).
   *
   * Один метод на оба варианта одного эндпоинта: без фотографий уходит JSON, с
   * фотографиями — multipart. Различается кодировка запроса, а не операция, и заставлять
   * форму выбирать между ними значило бы вынести деталь транспорта в интерфейс.
   *
   * Ни автора, ни статуса, ни номера здесь нет: их ставит бэкенд, и передать их некуда.
   */
  create({ photos = [], ...fields }: CreateServiceRequestInput): Promise<ServiceRequest> {
    if (photos.length === 0) {
      return request<ServiceRequest>('/service-requests', { method: 'POST', body: fields });
    }
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, String(value));
    }
    for (const photo of photos) form.append('photos', photo);
    return requestMultipart<ServiceRequest>('/service-requests', form);
  },

  /**
   * Отмена новой заявки (BE-002 §5.4) — то, что на экране называется «Удалить заявку».
   *
   * `POST`, а не `DELETE`: физического удаления нет, запись остаётся со статусом
   * `CANCELLED` и уходит в «Историю» (§7).
   */
  cancel(id: number): Promise<ServiceRequest> {
    return request<ServiceRequest>(`/service-requests/${id}/cancel`, { method: 'POST' });
  },

  /**
   * Возврат выполненной заявки в работу (BE-006, §8). Причина обязательна, исполнителя
   * автор не выбирает — в запросе такого поля нет. Кому достанется заявка и в каком она
   * окажется статусе, решает бэкенд.
   */
  reopen(id: number, comment: string): Promise<ServiceRequest> {
    return request<ServiceRequest>(`/service-requests/${id}/reopen`, {
      method: 'POST',
      body: { comment },
    });
  },

  /**
   * Содержимое снимка (BE-005 §4).
   *
   * Потоком под авторизацией, поэтому `<img src>` на эндпоинт не навести — в теге нет
   * заголовка. Забираем blob и оборачиваем в object URL на стороне компонента.
   */
  photo(requestId: number, photoId: number, signal?: AbortSignal): Promise<Blob> {
    return requestBlob(`/service-requests/${requestId}/photos/${photoId}/content`, signal);
  },
};
