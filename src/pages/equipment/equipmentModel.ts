import type { BadgeTone } from '@/components/ui/Badge';
import { ApiError } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type EquipmentUnit = Schema<'EquipmentUnitView'>;
export type EquipmentEvent = Schema<'EquipmentEventView'>;

/**
 * Слова модуля техники. Живут здесь, а не по месту, потому что спрашивают их трое: таблица
 * «В наличии», таблица «Выдано» и журнал, — и одно состояние не должно называться на
 * соседних вкладках по-разному.
 */
export const EQUIPMENT_STATES: Record<string, { label: string; tone: BadgeTone }> = {
  IN_STOCK: { label: 'В наличии', tone: 'green' },
  ISSUED: { label: 'Выдано', tone: 'blue' },
  WRITTEN_OFF: { label: 'Списано', tone: 'gray' },
};

export function equipmentState(state: string | undefined) {
  if (!state) return { label: '—', tone: 'gray' as const };
  return EQUIPMENT_STATES[state] ?? { label: state, tone: 'gray' as const };
}

/**
 * Типы проблем (ТЗ §6). Женский род — речь о единице техники: «Повреждена», «Потеряна».
 *
 * Подсказка объясняет не сам тип, а его последствие: «Потеряна» — единственная, которая
 * запрещает выдачу и передачу, и узнать об этом из одного названия нельзя.
 */
export const EQUIPMENT_PROBLEMS: { value: 'DAMAGED' | 'NOT_WORKING' | 'LOST'; label: string; hint: string }[] = [
  { value: 'DAMAGED', label: 'Повреждена', hint: 'Пользоваться можно с оговорками — выдавать не мешает' },
  { value: 'NOT_WORKING', label: 'Не работает', hint: 'Можно выдать техслужбе в ремонт' },
  { value: 'LOST', label: 'Потеряна', hint: 'Выдать и передать нельзя, пока не найдётся' },
];

export function equipmentProblemLabel(problem: Schema<'EquipmentProblemView'> | undefined): string | null {
  if (!problem) return null;
  return EQUIPMENT_PROBLEMS.find((item) => item.value === problem.type)?.label ?? 'Есть проблема';
}

export const EQUIPMENT_ACTIONS: Record<string, { label: string; tone: BadgeTone }> = {
  UNIT_CREATED: { label: 'Принято на учёт', tone: 'green' },
  UNIT_UPDATED: { label: 'Изменены номера', tone: 'blue' },
  ITEM_RENAMED: { label: 'Позиция переименована', tone: 'blue' },
  ISSUED: { label: 'Выдано', tone: 'blue' },
  RETURNED: { label: 'Принято обратно', tone: 'green' },
  TRANSFERRED: { label: 'Передано', tone: 'purple' },
  PROBLEM_SET: { label: 'Проблема', tone: 'red' },
  PROBLEM_CHANGED: { label: 'Проблема изменена', tone: 'amber' },
  PROBLEM_CLEARED: { label: 'Проблема снята', tone: 'green' },
  WRITTEN_OFF: { label: 'Списано', tone: 'gray' },
};

/** Справочник действий открытый: незнакомое значение показываем как есть, а не ломаемся. */
export function equipmentAction(action: string | undefined) {
  if (!action) return { label: 'Событие', tone: 'gray' as const };
  return EQUIPMENT_ACTIONS[action] ?? { label: action, tone: 'gray' as const };
}

/** Кого касалось действие: у передачи — обе стороны, у возврата — прежний держатель. */
export function eventEmployee(event: EquipmentEvent): string {
  const before = event.holderBefore?.fullName;
  const after = event.holderAfter?.fullName;
  if (event.action === 'TRANSFERRED' && before && after) return `${before} → ${after}`;
  if (event.action === 'RETURNED' || event.action === 'WRITTEN_OFF') return before ?? '—';
  return after ?? before ?? '—';
}

export type EquipmentEventGroup = {
  key: string;
  first: EquipmentEvent;
  events: EquipmentEvent[];
};

/** Пакетная команда пишет событие на экземпляр; журнал показывает их одним действием. */
export function collapseEquipmentEvents(events: EquipmentEvent[]): EquipmentEventGroup[] {
  const groups = new Map<string, EquipmentEventGroup>();
  events.forEach((event, index) => {
    const key = event.operationId || `event-${event.id ?? index}`;
    const group = groups.get(key);
    if (group) group.events.push(event);
    else groups.set(key, { key, first: event, events: [event] });
  });
  return [...groups.values()];
}

export function eventItemName(group: EquipmentEventGroup): string {
  const names = [...new Set(group.events.map((event) => event.itemName).filter(Boolean))];
  if (names.length === 0) return '—';
  return names.length === 1 ? names[0]! : `${names.length} позиции`;
}

/**
 * Что показать в колонке «Экземпляр»: номер — если действие было над одним, иначе счёт.
 *
 * У переименования позиции и правки номеров показываем прежнее значение стрелкой: событие
 * о том и рассказывает, а новое видно в таблице.
 */
export function eventUnitLabel(group: EquipmentEventGroup): string {
  if (group.events.length > 1) return `${group.events.length} экз.`;
  const event = group.first;
  const number = event.inventoryNumber ?? '—';
  if (event.action === 'UNIT_UPDATED' && event.inventoryNumberBefore) {
    return `${event.inventoryNumberBefore} → ${number}`;
  }
  return number;
}

/** «Было → стало» у переименования позиции — в колонке позиции читается понятнее. */
export function eventItemRename(event: EquipmentEvent): string | null {
  if (event.action !== 'ITEM_RENAMED' || !event.itemNameBefore) return null;
  return `${event.itemNameBefore} → ${event.itemName ?? ''}`;
}

/**
 * Разбор отказа пакетной команды (контракт §5).
 *
 * Форма `details` зависит от размера запроса, а не от числа отказавших: один экземпляр —
 * объект, несколько — массив. Клиент показывает одно и то же сообщение, поэтому приводим
 * обе формы к списку здесь, а не в каждом месте вызова.
 */
/**
 * Тип описан здесь, а не взят из сгенерированных: springdoc не знает про `details` отказа
 * — `EquipmentUnitConflictView` не возвращается ни одним успешным ответом, поэтому в схему
 * он не попадает. Поля перечислены в контракте §5.
 */
export type EquipmentConflict = {
  unitId?: number;
  itemName?: string;
  inventoryNumber?: string;
  code?: string;
  message?: string;
  holder?: { accountId?: number; fullName?: string };
};

export function conflictRows(error: unknown): EquipmentConflict[] {
  if (!(error instanceof ApiError) || !error.details) return [];
  const details = error.details as EquipmentConflict | EquipmentConflict[];
  const rows = Array.isArray(details) ? details : [details];
  return rows.filter((row) => row && typeof row === 'object' && 'unitId' in row);
}

/** Держатель из отказа «числится за сотрудником»: им подписывают подтверждение списания. */
export function conflictHolderName(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.details) return null;
  const details = error.details as { holder?: { fullName?: string } };
  return details?.holder?.fullName ?? null;
}

/** Позиция из отказа «название занято»: клиент предлагает добавить экземпляры в неё. */
export function conflictItem(error: unknown): { itemId: number; name: string } | null {
  if (!(error instanceof ApiError) || error.code !== 'EQUIPMENT_ITEM_NAME_TAKEN') return null;
  const details = error.details as { itemId?: number; name?: string } | undefined;
  return details?.itemId ? { itemId: details.itemId, name: details.name ?? '' } : null;
}

/** Занятые инвентарные номера из отказа — подсвечиваем строки формы, а не весь запрос. */
export function takenInventoryNumbers(error: unknown): string[] {
  if (!(error instanceof ApiError) || error.code !== 'EQUIPMENT_INVENTORY_NUMBER_TAKEN') return [];
  const details = error.details as { inventoryNumber?: string }[] | undefined;
  return (details ?? []).map((row) => row.inventoryNumber ?? '').filter(Boolean);
}

export function errorMessage(error: unknown, fallback = 'Не удалось выполнить действие'): string {
  return error instanceof ApiError ? error.message : fallback;
}
