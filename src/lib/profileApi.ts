import { request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

/**
 * Свой профиль (`MyProfileController`).
 *
 * Адрес без идентификатора — чужой профиль отсюда не открыть в принципе, а не «нельзя
 * по правам». Административные карточки людей живут под `/api/admin/**` и остаются
 * административными: учителю и психологу туда нельзя, а общий `request()` читает 401
 * оттуда как конец сессии и разлогинивает. Поэтому за своими же данными экран ходит
 * сюда, а не в карточку учителя.
 *
 * Заполненные части у ролей разные: у администратора нет ни классов, ни детей — это не
 * ошибка и не пустой ответ, а форма роли.
 */

export type MyProfile = Schema<'MyProfileView'>;
export type MyProfileTeacher = NonNullable<MyProfile['teacher']>;
export type MyProfileAssignment = NonNullable<MyProfileTeacher['assignments']>[number];
export type MyProfileChild = NonNullable<MyProfile['children']>[number];

export const profileApi = {
  me: (signal?: AbortSignal) => request<MyProfile>('/me/profile', { signal }),
};
