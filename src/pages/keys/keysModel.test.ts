import { describe, expect, it } from 'vitest';
import { collapseKeyEvents, eventEmployee, keyAction, keyProblemLabel } from './keysModel';

describe('представление истории ключей', () => {
  it('показывает обе стороны передачи', () => {
    expect(eventEmployee({
      action: 'TRANSFERRED',
      holderBefore: { fullName: 'Иванов И.И.' },
      holderAfter: { fullName: 'Петров П.П.' },
    })).toBe('Иванов И.И. → Петров П.П.');
  });

  it('не ломается на новом действии бэкенда', () => {
    expect(keyAction('INVENTORY_CHECKED')).toEqual({ label: 'INVENTORY_CHECKED', tone: 'gray' });
  });

  it('переводит известные проблемы и сохраняет безопасный fallback', () => {
    expect(keyProblemLabel({ type: 'LOST' })).toBe('Утерян');
    expect(keyProblemLabel({ type: 'NEW_PROBLEM' as 'LOST' })).toBe('Есть проблема');
  });

  it('сворачивает пакетную выдачу в одно действие', () => {
    const groups = collapseKeyEvents([
      { id: 1, operationId: '22222222-2222-2222-2222-222222222222', action: 'ISSUED' },
      { id: 2, operationId: '22222222-2222-2222-2222-222222222222', action: 'ISSUED' },
      { id: 3, operationId: '33333333-3333-3333-3333-333333333333', action: 'RETURNED' },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.events).toHaveLength(2);
  });
});
