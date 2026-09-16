import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import {
  collapseEquipmentEvents,
  conflictHolderName,
  conflictItem,
  conflictRows,
  equipmentAction,
  equipmentProblemLabel,
  eventEmployee,
  eventUnitLabel,
  takenInventoryNumbers,
} from './equipmentModel';

describe('представление истории техники', () => {
  it('показывает обе стороны передачи', () => {
    expect(eventEmployee({
      action: 'TRANSFERRED',
      holderBefore: { fullName: 'Иванов И.И.' },
      holderAfter: { fullName: 'Петров П.П.' },
    })).toBe('Иванов И.И. → Петров П.П.');
  });

  it('у списания показывает последнего держателя, а не пустоту', () => {
    expect(eventEmployee({ action: 'WRITTEN_OFF', holderBefore: { fullName: 'Иванов И.И.' } }))
      .toBe('Иванов И.И.');
  });

  it('не ломается на новом действии бэкенда', () => {
    expect(equipmentAction('INVENTORY_CHECKED')).toEqual({ label: 'INVENTORY_CHECKED', tone: 'gray' });
  });

  it('переводит известные проблемы и сохраняет безопасный fallback', () => {
    expect(equipmentProblemLabel({ type: 'LOST' })).toBe('Потеряна');
    expect(equipmentProblemLabel({ type: 'FLOODED' as 'LOST' })).toBe('Есть проблема');
    expect(equipmentProblemLabel(undefined)).toBeNull();
  });

  it('сворачивает пакетную выдачу в одно действие', () => {
    const groups = collapseEquipmentEvents([
      { id: 1, operationId: '22222222-2222-2222-2222-222222222222', action: 'ISSUED' },
      { id: 2, operationId: '22222222-2222-2222-2222-222222222222', action: 'ISSUED' },
      { id: 3, operationId: '33333333-3333-3333-3333-333333333333', action: 'RETURNED' },
    ]);
    expect(groups).toHaveLength(2);
    expect(eventUnitLabel(groups[0]!)).toBe('2 экз.');
  });

  it('у правки номера показывает «было → стало»', () => {
    const groups = collapseEquipmentEvents([
      { id: 4, action: 'UNIT_UPDATED', inventoryNumber: 'INV-2', inventoryNumberBefore: 'INV-1' },
    ]);
    expect(eventUnitLabel(groups[0]!)).toBe('INV-1 → INV-2');
  });
});

describe('разбор отказов', () => {
  it('приводит details одиночного и пакетного отказа к одному списку', () => {
    const single = new ApiError(409, 'занято', 'EQUIPMENT_UNIT_ALREADY_ISSUED', {
      unitId: 1,
      inventoryNumber: 'INV-1',
    });
    const batch = new ApiError(409, 'пакет', 'EQUIPMENT_BATCH_CONFLICT', [
      { unitId: 1, inventoryNumber: 'INV-1' },
      { unitId: 2, inventoryNumber: 'INV-2' },
    ]);

    expect(conflictRows(single)).toHaveLength(1);
    expect(conflictRows(batch)).toHaveLength(2);
    expect(conflictRows(new Error('сеть'))).toEqual([]);
  });

  it('достаёт держателя из отказа «числится за сотрудником»', () => {
    const error = new ApiError(409, 'числится', 'EQUIPMENT_UNIT_STILL_ISSUED', {
      unitId: 7,
      holder: { accountId: 3, fullName: 'Иванов И.И.' },
    });
    expect(conflictHolderName(error)).toBe('Иванов И.И.');
  });

  it('достаёт существующую позицию — форма предлагает добавить экземпляры в неё', () => {
    const error = new ApiError(409, 'занято', 'EQUIPMENT_ITEM_NAME_TAKEN', {
      itemId: 12,
      name: 'Проектор Epson',
    });
    expect(conflictItem(error)).toEqual({ itemId: 12, name: 'Проектор Epson' });
    expect(conflictItem(new ApiError(409, 'другое', 'EQUIPMENT_BATCH_CONFLICT', []))).toBeNull();
  });

  it('достаёт занятые инвентарные номера — подсвечиваются строки, а не весь запрос', () => {
    const error = new ApiError(409, 'занят', 'EQUIPMENT_INVENTORY_NUMBER_TAKEN', [
      { inventoryNumber: 'INV-1', unitId: 5, itemId: 2, itemName: 'Ноутбук' },
    ]);
    expect(takenInventoryNumbers(error)).toEqual(['INV-1']);
  });
});
