import type { Schema } from '@/lib/apiSchemas';

/**
 * Внутренние сотрудники школы (ТЗ SERVICE-FE-004 §3, §4).
 *
 * Роли и статусы берутся из сгенерированного `AccountView`, а не объявляются заново:
 * набор значений задаёт бэкенд, и второй список рядом разошёлся бы с ним при первой же
 * новой роли.
 *
 * Здесь нет ни одного правила, которого нет на бэкенде. «Заблокировать» — это `/block`,
 * и возврат заявок в очередь делает он же: `AccountAdminService.block` публикует
 * `AccountDeactivatedEvent`, а `ServiceRequestAssignmentReleaseListener` снимает с
 * сотрудника его `IN_PROGRESS` (SERVICE-BE-007 §9). Экран этого не повторяет — он
 * перечитывает заявки после успешного ответа (§4).
 *
 * <b>Слова те же, что в «Пользователях».</b> ТЗ §3 называет состояния Active / Inactive,
 * но действие за ними то же самое, что у общей таблицы аккаунтов, — и звать его двумя
 * словами в двух разделах одной панели значило бы делать вид, что это разные операции.
 */

type AccountView = Schema<'AccountView'>;

export type AccountRoleValue = NonNullable<AccountView['role']>;
export type AccountStatusValue = NonNullable<AccountView['status']>;

/** §3: три служебные роли. Порядок — как в списке ТЗ. */
export const EMPLOYEE_ROLES = ['CLEANING', 'TECHNICIAN', 'SECURITY'] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export const EMPLOYEE_ROLE_LABELS: Record<EmployeeRole, string> = {
  CLEANING: 'Клининг',
  TECHNICIAN: 'Техслужба',
  SECURITY: 'Охрана',
};

/**
 * Роли, которым заявка может достаться в работу.
 *
 * Охраны здесь нет намеренно: она заводит заявки, но своей очереди у неё не появится
 * (SERVICE-BE-002, `AccountRole.SECURITY`). Поэтому фильтр «Текущий исполнитель» (§6)
 * ищет людей только среди этих двух ролей — предлагать охранника значило бы обещать
 * заведомо пустую выдачу.
 */
export const ASSIGNEE_ROLES = ['CLEANING', 'TECHNICIAN'] as const satisfies ReadonlyArray<
  EmployeeRole
>;

export function isEmployeeRole(role: string | undefined): role is EmployeeRole {
  return EMPLOYEE_ROLES.includes(role as EmployeeRole);
}

export function employeeRoleLabel(role: AccountRoleValue | undefined): string {
  return isEmployeeRole(role) ? EMPLOYEE_ROLE_LABELS[role] : '—';
}

/**
 * Active / Inactive из §3 — это два крупных мазка поверх четырёх статусов аккаунта,
 * которыми фильтруется список.
 *
 * `NOT_ACTIVATED` считается действующим: сотрудника никто не блокировал, он просто ещё
 * не входил. Само различие при этом не теряется — в строке стоит настоящий статус
 * аккаунта, теми же словами, что в общей таблице «Пользователи».
 */
export type EmployeeState = 'ACTIVE' | 'INACTIVE';

export function employeeState(status: AccountStatusValue | undefined): EmployeeState {
  return status === 'BLOCKED' || status === 'ARCHIVED' ? 'INACTIVE' : 'ACTIVE';
}

/** Подписи вкладок-фильтров. Состояние одного сотрудника подписывает статус аккаунта. */
export const EMPLOYEE_STATE_FILTER_LABELS: Record<EmployeeState, string> = {
  ACTIVE: 'Активные',
  INACTIVE: 'Заблокированные',
};

/**
 * §3: Active → Inactive, то есть `/block`. Архивного блокировать нечего — вход у него
 * уже отозван, и бэкенд отвечает «Archived account cannot be blocked».
 */
export function canBlock(status: AccountStatusValue | undefined): boolean {
  return status === 'ACTIVE' || status === 'NOT_ACTIVATED';
}

/**
 * §3: Inactive → Active, то есть `/unblock`.
 *
 * Только из `BLOCKED`: `unblock` требует именно этого статуса, а архив — не заблокированный
 * сотрудник, а закрытая учётная запись, и вернуть её этой кнопкой нельзя.
 */
export function canUnblock(status: AccountStatusValue | undefined): boolean {
  return status === 'BLOCKED';
}
