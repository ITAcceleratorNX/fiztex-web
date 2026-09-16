import { pageQuery, request } from './api';
import type { Schema } from './apiSchemas';

export type EquipmentState = 'IN_STOCK' | 'ISSUED';

export type EquipmentDashboardFilters = {
  state: EquipmentState;
  query?: string;
  itemId?: number;
  hasProblem?: boolean;
  holderInactive?: boolean;
};

export type EquipmentHistoryFilters = {
  action?: string;
  itemId?: number;
  page: number;
  size: number;
};

/**
 * Клиент раздела «Техника и инвентарь» — Super Admin (ТЗ §2, §8).
 *
 * <p>Пишет и читает один и тот же раздел, в отличие от ключей: там веб только смотрит,
 * потому что на посту работает охрана со своего телефона. Здесь оба конца — один человек,
 * и половина модуля, доступная только с телефона, означала бы, что поставить технику на
 * учёт с компьютера нельзя.
 *
 * <p>Ни одно правило перехода тут не повторяется: можно ли выдать и передать, приходит
 * посчитанным (`issuable`, `transferable`), а отказ — с кодом.
 */
export const equipmentApi = {
  dashboard(filters: EquipmentDashboardFilters, signal?: AbortSignal) {
    return request<Schema<'EquipmentDashboardView'>>(`/equipment/dashboard${pageQuery(filters)}`, {
      signal,
    });
  },

  /** Справочник позиций: позиция без действующих экземпляров есть только здесь. */
  items(query: string | undefined, signal?: AbortSignal) {
    return request<Schema<'EquipmentItemOptionView'>[]>(`/equipment/items${pageQuery({ query })}`, {
      signal,
    });
  },

  unit(unitId: number, signal?: AbortSignal) {
    return request<Schema<'EquipmentUnitCardView'>>(`/equipment/units/${unitId}`, { signal });
  },

  history(filters: EquipmentHistoryFilters, signal?: AbortSignal) {
    // `sort` не передаём: умолчание контроллера — обязательный устойчивый
    // `createdAt DESC, id DESC`, и своя сортировка потеряла бы второй ключ.
    return request<Schema<'PageEquipmentEventView'>>(`/equipment/history${pageQuery(filters)}`, {
      signal,
    });
  },

  recipients(query: string | undefined, signal?: AbortSignal) {
    return request<Schema<'EquipmentRecipientView'>[]>(
      `/equipment/recipients${pageQuery({ query, limit: 30 })}`,
      { signal },
    );
  },

  createItem(body: Schema<'CreateEquipmentItemRequest'>) {
    return request<Schema<'EquipmentItemView'>>('/equipment/items', { method: 'POST', body });
  },

  updateItem(itemId: number, body: Schema<'UpdateEquipmentItemRequest'>) {
    return request<Schema<'EquipmentItemView'>>(`/equipment/items/${itemId}`, {
      method: 'PATCH',
      body,
    });
  },

  addUnits(itemId: number, body: Schema<'AddEquipmentUnitsRequest'>) {
    return request<Schema<'EquipmentUnitView'>[]>(`/equipment/items/${itemId}/units`, {
      method: 'POST',
      body,
    });
  },

  updateUnit(unitId: number, body: Schema<'UpdateEquipmentUnitRequest'>) {
    return request<Schema<'EquipmentUnitView'>>(`/equipment/units/${unitId}`, {
      method: 'PATCH',
      body,
    });
  },

  /** §7.6: списание. Выданное — только с `confirmIssued`, иначе 409 с держателем. */
  writeOff(unitId: number, body: Schema<'WriteOffEquipmentRequest'>) {
    return request<Schema<'EquipmentUnitView'>>(`/equipment/units/${unitId}/write-off`, {
      method: 'POST',
      body,
    });
  },

  issue(body: Schema<'IssueEquipmentRequest'>) {
    return request<Schema<'EquipmentOperationView'>>('/equipment/issue', { method: 'POST', body });
  },

  returnUnits(body: Schema<'ReturnEquipmentRequest'>) {
    return request<Schema<'EquipmentOperationView'>>('/equipment/return', { method: 'POST', body });
  },

  transfer(body: Schema<'TransferEquipmentRequest'>) {
    return request<Schema<'EquipmentOperationView'>>('/equipment/transfer', {
      method: 'POST',
      body,
    });
  },

  setProblem(unitId: number, body: Schema<'SetEquipmentProblemRequest'>) {
    return request<Schema<'EquipmentUnitView'>>(`/equipment/units/${unitId}/problem`, {
      method: 'POST',
      body,
    });
  },

  resolveProblem(unitId: number, body: Schema<'ResolveEquipmentProblemRequest'>) {
    return request<Schema<'EquipmentUnitView'>>(`/equipment/units/${unitId}/problem/resolve`, {
      method: 'POST',
      body,
    });
  },
};
