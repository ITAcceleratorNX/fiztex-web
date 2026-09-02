import { pageQuery, request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import type {
  ServiceRequestAction,
  ServiceRequestStatus,
  ServiceType,
} from '@/lib/serviceRequestsApi';

/**
 * Super Admin: все заявки школы и глобальный журнал (ТЗ SERVICE-FE-004 §5–§9,
 * бэкенд SERVICE-BE-007).
 *
 * Отдельным файлом от `serviceRequestsApi`, а не соседним методом в нём: тот объект
 * держит ровно сценарий автора и этим ограничением полезен. Здесь — противоположное:
 * чтение всего, что есть в школе, и ни одного действия.
 *
 * **Только GET.** Ни назначения исполнителя, ни смены статуса или службы чужой заявки
 * здесь нет — и не потому, что они закомментированы: таких эндпоинтов нет и на бэкенде
 * (§10, `ServiceRequestAdminController`). Карточка чужой заявки поэтому read-only сама
 * собой, а не благодаря проверке на экране.
 *
 * Карточка и лента отдельной заявки живут в `serviceRequestsApi`: Super Admin открывает
 * тот же `/api/service-requests/{id}`, что и все, — политика доступа выдаёт ему просмотр
 * (SERVICE-BE-007 §1). Второй административный эндпоинт с тем же содержимым разошёлся бы
 * с первым при первой правке.
 */

export type ServiceRequestPage = Schema<'PageServiceRequestView'>;
export type ServiceRequestAuditEntry = Schema<'ServiceRequestAuditEntryView'>;
export type ServiceRequestAuditPage = Schema<'PageServiceRequestAuditEntryView'>;

/** §6: фильтры раздела «Все заявки». Пустая строка и `null` — «не фильтровать». */
export interface AllRequestsFilter {
  status: ServiceRequestStatus | null;
  serviceType: ServiceType | null;
  /** «Экстренная / обычная»: `true` — только экстренные, `false` — только обычные. */
  emergency: boolean | null;
  authorId: number | null;
  assigneeId: number | null;
  /** Дата создания, `YYYY-MM-DD`. Границы включительные — их разворачивает бэкенд. */
  createdFrom: string;
  createdTo: string;
  /** §7: общий поиск — номер, ФИО автора и исполнителя, место, описание. */
  search: string;
}

export const EMPTY_REQUESTS_FILTER: AllRequestsFilter = {
  status: null,
  serviceType: null,
  emergency: null,
  authorId: null,
  assigneeId: null,
  createdFrom: '',
  createdTo: '',
  search: '',
};

export function hasActiveFilters(filter: AllRequestsFilter): boolean {
  return (
    filter.status !== null ||
    filter.serviceType !== null ||
    filter.emergency !== null ||
    filter.authorId !== null ||
    filter.assigneeId !== null ||
    filter.createdFrom !== '' ||
    filter.createdTo !== '' ||
    filter.search.trim() !== ''
  );
}

/** §9: фильтры глобального журнала. */
export interface AuditFilter {
  requestId: number | null;
  actorId: number | null;
  action: ServiceRequestAction | null;
  from: string;
  to: string;
}

export const EMPTY_AUDIT_FILTER: AuditFilter = {
  requestId: null,
  actorId: null,
  action: null,
  from: '',
  to: '',
};

export function hasActiveAuditFilters(filter: AuditFilter): boolean {
  return (
    filter.requestId !== null ||
    filter.actorId !== null ||
    filter.action !== null ||
    filter.from !== '' ||
    filter.to !== ''
  );
}

export const ADMIN_PAGE_SIZE = 20;
export const AUDIT_PAGE_SIZE = 30;

export const serviceRequestsAdminApi = {
  /**
   * Все заявки школы (§5).
   *
   * Порядок клиент не задаёт: «последняя активность сверху» — это `updatedAt DESC` на
   * бэкенде (BE-007 §2), и повторять его сортировкой пришедшей страницы бессмысленно —
   * страница уже отрезана этим порядком.
   */
  all(
    filter: AllRequestsFilter,
    page: number,
    size = ADMIN_PAGE_SIZE,
    signal?: AbortSignal,
  ): Promise<ServiceRequestPage> {
    const query = pageQuery({
      status: filter.status ?? undefined,
      serviceType: filter.serviceType ?? undefined,
      // `?? undefined` вместо `|| undefined`: `emergency=false` — это фильтр «обычные»,
      // а не «фильтра нет».
      emergency: filter.emergency ?? undefined,
      authorId: filter.authorId ?? undefined,
      assigneeId: filter.assigneeId ?? undefined,
      createdFrom: filter.createdFrom || undefined,
      createdTo: filter.createdTo || undefined,
      q: filter.search.trim() || undefined,
      page,
      size,
    });
    return request<ServiceRequestPage>(`/admin/service-requests${query}`, { signal });
  },

  /** §9: события по всем заявкам, свежие сверху (порядок задаёт бэкенд). */
  audit(
    filter: AuditFilter,
    page: number,
    size = AUDIT_PAGE_SIZE,
    signal?: AbortSignal,
  ): Promise<ServiceRequestAuditPage> {
    const query = pageQuery({
      requestId: filter.requestId ?? undefined,
      actorId: filter.actorId ?? undefined,
      action: filter.action ?? undefined,
      from: filter.from || undefined,
      to: filter.to || undefined,
      page,
      size,
    });
    return request<ServiceRequestAuditPage>(`/admin/service-requests/audit${query}`, { signal });
  },
};
