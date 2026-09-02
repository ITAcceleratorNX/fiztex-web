import { describe, expect, it } from 'vitest';
import {
  ASSIGNEE_ROLES,
  EMPLOYEE_ROLES,
  canBlock,
  canUnblock,
  employeeRoleLabel,
  employeeState,
  isEmployeeRole,
} from './employeesModel';

describe('внутренние сотрудники (SERVICE-FE-004 §3)', () => {
  it('заведённый, но ещё не входивший сотрудник считается активным', () => {
    // Аккаунт никто не блокировал — человек просто не дошёл до приложения. В
    // «Заблокированных» ему не место, иначе список смешает «выключен» и «ещё не начал».
    expect(employeeState('NOT_ACTIVATED')).toBe('ACTIVE');
    expect(employeeState('ACTIVE')).toBe('ACTIVE');
    expect(employeeState('BLOCKED')).toBe('INACTIVE');
    expect(employeeState('ARCHIVED')).toBe('INACTIVE');
  });

  /**
   * Действия повторяют то, что примет бэкенд: `block` отказывает архивному
   * («Archived account cannot be blocked»), `unblock` — всем, кроме заблокированного
   * («Account is not blocked»). Кнопка, ведущая к отказу, хуже отсутствующей.
   */
  it('заблокировать можно действующего, разблокировать — только заблокированного', () => {
    expect(canBlock('ACTIVE')).toBe(true);
    expect(canBlock('NOT_ACTIVATED')).toBe(true);
    expect(canBlock('BLOCKED')).toBe(false);
    expect(canBlock('ARCHIVED')).toBe(false);

    expect(canUnblock('BLOCKED')).toBe(true);
    expect(canUnblock('ACTIVE')).toBe(false);
    expect(canUnblock('NOT_ACTIVATED')).toBe(false);
    // Архив — не заблокированный сотрудник, а закрытая учётная запись: `unblock` её не вернёт.
    expect(canUnblock('ARCHIVED')).toBe(false);
  });

  it('исполнителем может быть клининг и техслужба, но не охрана', () => {
    // У охраны своей очереди нет и не появится (SERVICE-BE-003 §10), поэтому в фильтре
    // «Текущий исполнитель» ей нечего делать: выдача была бы заведомо пустой.
    expect([...ASSIGNEE_ROLES]).toEqual(['CLEANING', 'TECHNICIAN']);
    expect([...EMPLOYEE_ROLES]).toContain('SECURITY');
  });

  it('роли отличаются от остальных аккаунтов', () => {
    expect(isEmployeeRole('CLEANING')).toBe(true);
    expect(isEmployeeRole('TEACHER')).toBe(false);
    expect(isEmployeeRole(undefined)).toBe(false);
    expect(employeeRoleLabel('TECHNICIAN')).toBe('Техслужба');
    expect(employeeRoleLabel('ADMIN')).toBe('—');
  });
});
