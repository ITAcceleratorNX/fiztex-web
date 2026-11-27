import { request } from './api';
import type { Schema } from './apiSchemas';

export type StudyAccessGrant = Schema<'StudyAccessGrantView'>;
export type StudyAccessTeacherGrants = Schema<'StudyAccessTeacherGrantsView'>;
export type StudyAccessOptions = Schema<'StudyAccessOptionsView'>;
export type StudyAccessOptionsYear = Schema<'StudyAccessOptionsYearView'>;
export type StudyAccessScope = Schema<'StudyAccessScopeView'>;
export type StudyAccessHistory = Schema<'StudyAccessGrantHistoryView'>;
export type StudyAccessMine = Schema<'StudyAccessMineView'>;
export type StudyAccessMyGrant = Schema<'StudyAccessMyGrantView'>;
export type CreateStudyAccessGrant = Schema<'CreateStudyAccessGrantRequest'>;
export type UpdateStudyAccessGrant = Schema<'UpdateStudyAccessGrantRequest'>;
export type StudyDataSection = NonNullable<StudyAccessGrant['sections']>[number];
export type StudyDataScopeType = Schema<'StudyDataAccessScopeRequest'>['type'];

/**
 * Дополнительные права учителя на чтение учебных данных (STUDY-ACCESS-001/002).
 *
 * **У учителя несколько независимых прав.** Выдача заводит новое, изменение и отзыв адресуются
 * праву по его id и не трогают остальные; эффективный доступ — их объединение на сервере.
 *
 * **Выдача идемпотентна по ключу.** Новая отправка формы — новый UUID, «Повторить» после сбоя
 * связи — тот же: если первый запрос дошёл, сервер вернёт уже выданное право (200), а не
 * заведёт второе. Ключ выбирает экран — только он знает, повтор это или новая попытка.
 *
 * **Изменение несёт `expectedRevision`.** Если право успели изменить или отозвать в другой
 * вкладке, сервер отвечает 409 с актуальным правом в `details`, и форма не затирает чужое.
 *
 * Контракт — `fiztex-back/docs/study-data-access-contract.md`.
 */
export const studyAccessApi = {
  teacherGrants(teacherProfileId: number, signal?: AbortSignal) {
    return request<StudyAccessTeacherGrants>(`/admin/study-data-access/teachers/${teacherProfileId}`, { signal });
  },

  options(signal?: AbortSignal) {
    return request<StudyAccessOptions>('/admin/study-data-access/options', { signal });
  },

  create(teacherProfileId: number, body: CreateStudyAccessGrant, idempotencyKey: string) {
    return request<StudyAccessGrant>(`/admin/study-data-access/teachers/${teacherProfileId}/grants`, {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  },

  update(grantId: number, body: UpdateStudyAccessGrant) {
    return request<StudyAccessGrant>(`/admin/study-data-access/grants/${grantId}`, { method: 'PUT', body });
  },

  revoke(grantId: number) {
    return request<StudyAccessGrant>(`/admin/study-data-access/grants/${grantId}/revoke`, { method: 'POST', body: {} });
  },

  history(grantId: number, signal?: AbortSignal) {
    return request<StudyAccessHistory>(`/admin/study-data-access/grants/${grantId}/history`, { signal });
  },

  /** Свои права учителя — для пояснений «до 31.05.2027» и «просмотр закончился». */
  mine(signal?: AbortSignal) {
    return request<StudyAccessMine>('/teacher/study-data-access', { signal });
  },
};
