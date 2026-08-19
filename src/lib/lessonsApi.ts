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
