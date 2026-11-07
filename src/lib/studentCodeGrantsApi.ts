import { request } from './api';
import type { Schema } from './apiSchemas';

export type StudentCodeGrant = Schema<'StudentCodeGrantView'>;

/**
 * Разрешения учителям выпускать персональный код ученику (AUTH-BE-001 §7.1).
 *
 * **Разрешение относится к паре «учитель + ученик», а не к роли.** Полномочия у учителя
 * здесь нет вовсе: `RolePermissions` даёт роли `TEACHER` одно право, и ни классное
 * руководство, ни предметное назначение выдачу кода не открывают. Основание —
 * строка `student_code_grants`, которую создаёт администратор.
 *
 * **Читается только по ученику.** Запроса «что разрешено этому учителю» на сервере нет,
 * поэтому список класса собирается запросом на каждого ученика. Для класса это 20–30
 * коротких GET-ов, и они идут параллельно; смысла в своём своде на клиенте нет — он
 * разошёлся бы с сервером на первом же отзыве.
 *
 * **Срок хранится как момент и истекает сам**: действующее разрешение — «не отозвано и
 * `expiresAt` ещё не прошёл». Поле `active` считает сервер, клиент его не досчитывает.
 */
export const studentCodeGrantsApi = {
  list(studentProfileId: number, signal?: AbortSignal) {
    return request<StudentCodeGrant[]>(
      `/admin/students/${studentProfileId}/code-grants`,
      { signal },
    );
  },

  grant(studentProfileId: number, body: Schema<'CreateStudentCodeGrantRequest'>) {
    return request<StudentCodeGrant>(`/admin/students/${studentProfileId}/code-grants`, {
      method: 'POST',
      body,
    });
  },

  revoke(studentProfileId: number, grantId: number) {
    return request<void>(`/admin/students/${studentProfileId}/code-grants/${grantId}`, {
      method: 'DELETE',
    });
  },
};
