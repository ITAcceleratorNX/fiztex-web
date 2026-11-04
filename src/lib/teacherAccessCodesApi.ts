import { request } from './api';
import type { Schema } from './apiSchemas';

export type TeacherStudentAccess = Schema<'TeacherStudentAccessView'>;

/**
 * Персональные коды учеников у учителя (AUTH-BE-001 §10).
 *
 * Список приходит **по разрешениям**, а не по классу: право выдать код администратор
 * открывает ученик за учеником (`student_code_grants`), и классный руководитель без
 * разрешения в этом списке ученика не увидит. Разрешение истекает само.
 */
export const teacherAccessCodesApi = {
  list(signal?: AbortSignal) {
    return request<TeacherStudentAccess[]>('/teacher/students/access-codes', { signal });
  },

  /**
   * Выпуск кода. Действующий код **не показывается** — в базе хэш, поэтому «показать»
   * физически означает «выпустить новый», и прежний перестаёт работать.
   */
  issue(studentProfileId: number, confirmReissue: boolean) {
    return request<Schema<'IssuedCodeResponse'>>(
      `/teacher/students/${studentProfileId}/access-code${confirmReissue ? '?confirmReissue=true' : ''}`,
      { method: 'POST' },
    );
  },
};
