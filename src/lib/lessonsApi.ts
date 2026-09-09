import { pageQuery, request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type Lesson = Schema<'LessonView'>;
export type LessonHistoryEntry = Schema<'LessonHistoryView'>;
export type LessonParticipant = Schema<'LessonParticipantView'>;
export type LessonCapability = NonNullable<Lesson['capabilities']>[number];
export type LessonChangedField = NonNullable<Lesson['changedFields']>[number];

type LessonPage = Schema<'PageLessonView'>;
export type RoleSchedule = Schema<'RoleScheduleView'>;
export type RoleScheduleLesson = NonNullable<RoleSchedule['lessons']>[number];
type LessonHistoryPage = Schema<'PageLessonHistoryView'>;

export interface LessonListParams {
  dateFrom?: string;
  dateTo?: string;
  classId?: number;
  teacherProfileId?: number;
  scheduleLessonId?: number;
  status?: NonNullable<Lesson['status']>;
  page?: number;
  size?: number;
}

/** Рабочее пространство урока: один путь на все роли, область видимости задаёт бэкенд. */
export const lessonsApi = {
  list(params: LessonListParams, signal?: AbortSignal): Promise<LessonPage> {
    return request<LessonPage>(`/lessons${pageQuery({ ...params })}`, { signal });
  },

  card(lessonId: number, signal?: AbortSignal): Promise<Lesson> {
    return request<Lesson>(`/lessons/${lessonId}`, { signal });
  },

  /**
   * Своя неделя — единственный источник «какие классы и предметы у меня есть», доступный
   * учителю. Справочники `/api/admin/*` ему отвечают 401, а общий `request()` считает это
   * концом сессии, поэтому спрашивать их с учительского экрана нельзя (см. `routes.ts`).
   *
   * `date` — любой день внутри нужной недели; без него берётся текущая.
   */
  myWeek(date?: string, signal?: AbortSignal): Promise<RoleSchedule> {
    return request<RoleSchedule>(`/schedule/me/week${pageQuery({ date })}`, { signal });
  },

  history(
    lessonId: number,
    params: { page?: number; size?: number } = {},
    signal?: AbortSignal,
  ): Promise<LessonHistoryPage> {
    return request<LessonHistoryPage>(`/lessons/${lessonId}/history${pageQuery({ ...params })}`, {
      signal,
    });
  },

  students(lessonId: number, signal?: AbortSignal): Promise<LessonParticipant[]> {
    return request<LessonParticipant[]>(`/lessons/${lessonId}/students`, { signal });
  },
};

export type SubstituteGradePermission = Schema<'SubstituteGradePermissionView'>;
export type LessonComment = Schema<'LessonCommentView'>;

/**
 * Учебная часть урока: тема и комментарий для учеников.
 *
 * Путь ролевой, не админский: правит их только тот, кто ведёт урок
 * (`EDIT_TEACHING_PART`). Администратору обе команды отвечают 403 — учебных действий
 * у него нет ни при каких условиях (LESSON-002 §5.1).
 *
 * Пустое значение — это удаление, а не пустая строка: у темы и комментария есть
 * состояние «не указано», и хранить вместо него `""` значит потерять разницу.
 */
export const lessonTeachingApi = {
  setTopic(lessonId: number, topic: string): Promise<Lesson> {
    return request<Lesson>(`/lessons/${lessonId}/topic`, { method: 'PUT', body: { topic } });
  },

  clearTopic(lessonId: number): Promise<Lesson> {
    return request<Lesson>(`/lessons/${lessonId}/topic`, { method: 'DELETE' });
  },

  setComment(lessonId: number, body: string): Promise<LessonComment> {
    return request<LessonComment>(`/lessons/${lessonId}/comment`, { method: 'PUT', body: { body } });
  },

  clearComment(lessonId: number): Promise<void> {
    return request<void>(`/lessons/${lessonId}/comment`, { method: 'DELETE' });
  },

  /**
   * «ДЗ не задано» — второе финальное действие по уроку наравне с выдачей задания.
   *
   * Ставится только руками: система не выводит отказ из пустоты, поэтому автоматики за
   * этой кнопкой нет ни на бэкенде, ни здесь.
   *
   * Отвечает карточкой целиком — `homeworkState` считается по всем заданиям урока, и
   * собрать его из ответа на одно действие нельзя.
   */
  markHomeworkNotAssigned(lessonId: number): Promise<Lesson> {
    return request<Lesson>(`/lessons/${lessonId}/homework/not-assigned`, { method: 'POST' });
  },

  /** Отмена отметки: урок возвращается в «Домашнее задание пока не указано». */
  clearHomeworkNotAssigned(lessonId: number): Promise<Lesson> {
    return request<Lesson>(`/lessons/${lessonId}/homework/not-assigned`, { method: 'DELETE' });
  },
};

/**
 * Разовые изменения урока: замена учителя и отмена (LESSON-002 §7).
 *
 * Живут под `/api/admin/*` и требуют `SCHEDULE_MANAGE`, поэтому вызывать их можно
 * только с админского экрана — учителю тот же путь ответит 401, а общий `request()`
 * трактует его как конец сессии (см. `routes.ts`).
 *
 * Каждая команда отвечает карточкой урока целиком: новое состояние не нужно
 * доспрашивать, его кладут в кэш напрямую.
 */
export const lessonAdminApi = {
  cancel(lessonId: number, body: { comment?: string }): Promise<Lesson> {
    return request<Lesson>(`/admin/lessons/${lessonId}/cancel`, { method: 'POST', body });
  },

  /**
   * Восстановление снимает только ручную отмену: календарные отмены движок
   * восстанавливает сам, и кнопки для них на карточке нет.
   */
  restore(lessonId: number): Promise<Lesson> {
    return request<Lesson>(`/admin/lessons/${lessonId}/restore`, { method: 'POST' });
  },

  assignSubstitute(
    lessonId: number,
    body: { teacherProfileId: number; reason?: string },
  ): Promise<Lesson> {
    return request<Lesson>(`/admin/lessons/${lessonId}/substitution`, { method: 'POST', body });
  },

  removeSubstitute(lessonId: number): Promise<Lesson> {
    return request<Lesson>(`/admin/lessons/${lessonId}/substitution`, { method: 'DELETE' });
  },
};

/**
 * Разрешение замещающему работать с оценками (GRADES-002 §12).
 *
 * Путь ролевой, а не админский: выдаёт его основной учитель урока **или** админ, а
 * замещающий своё состояние только читает. Само назначение замены прав на оценки не
 * даёт — нужен этот явный флаг, и новое назначение всегда начинается с `false`.
 */
export const substitutionApi = {
  gradePermission(lessonId: number, signal?: AbortSignal): Promise<SubstituteGradePermission> {
    return request<SubstituteGradePermission>(
      `/lessons/${lessonId}/substitution/grade-permission`,
      { signal },
    );
  },

  setGradePermission(
    lessonId: number,
    canManageGrades: boolean,
  ): Promise<SubstituteGradePermission> {
    return request<SubstituteGradePermission>(
      `/lessons/${lessonId}/substitution/grade-permission`,
      { method: 'PUT', body: { canManageGrades } },
    );
  },
};
