import { request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type GradeScaleValue = Schema<'GradeScaleValueView'>;
export type Grade = Schema<'GradeView'>;
export type LessonGradeSheet = Schema<'LessonGradeSheetView'>;
export type LessonGradeRow = Schema<'LessonGradeSheetRowView'>;
export type LessonGradeEntry = Schema<'LessonGradeEntryView'>;

export type GradeType = NonNullable<Grade['gradeType']>;
export type GradeWriteState = NonNullable<LessonGradeSheet['writeState']>;

/** Коды отказов, на которые у экрана оценок есть свой ответ (grades-read-contract §9). */
export const GRADE_ERRORS = {
  lessonLimitReached: 'GRADE_LESSON_LIMIT_REACHED',
  lessonCancelled: 'GRADE_LESSON_CANCELLED',
  lessonSuperseded: 'GRADE_LESSON_SUPERSEDED',
  studentNotInSource: 'GRADE_STUDENT_NOT_IN_SOURCE',
  periodNotResolved: 'GRADE_PERIOD_NOT_RESOLVED',
  deleted: 'GRADE_DELETED',
  notOwn: 'GRADE_NOT_OWN',
  substituteNotAssigned: 'GRADE_SUBSTITUTE_NOT_ASSIGNED',
  substituteNotPermitted: 'GRADE_SUBSTITUTE_NOT_PERMITTED',
  substituteWindowNotOpen: 'GRADE_SUBSTITUTE_WINDOW_NOT_OPEN',
  substituteWindowClosed: 'GRADE_SUBSTITUTE_WINDOW_CLOSED',
} as const;

/**
 * Оценки урока (GRADES-001, GRADES-002).
 *
 * <p>Экран берёт лист (`sheet`), а не плоский список: в листе есть состав класса,
 * авторство каждой оценки и посчитанный ответ «можно ли сейчас писать». Собирать это
 * из четырёх запросов и выводить права на клиенте нельзя — правила окна замещающего
 * живут на сервере и меняются там же.
 *
 * <p>Значение оценки — всегда `scaleCode` («4+»), а не число: числовое представление
 * приходит рядом только для показа. Шкала — справочник с сервера, не константа клиента.
 */
export const gradesApi = {
  scale(signal?: AbortSignal): Promise<GradeScaleValue[]> {
    return request<GradeScaleValue[]>('/grades/scale', { signal });
  },

  lessonSheet(lessonId: number, signal?: AbortSignal): Promise<LessonGradeSheet> {
    return request<LessonGradeSheet>(`/lessons/${lessonId}/grades/sheet`, { signal });
  },

  create(body: {
    studentProfileId: number;
    sourceType: 'LESSON' | 'HOMEWORK';
    sourceId: number;
    scaleCode: string;
    gradeType?: GradeType | null;
  }): Promise<Grade> {
    return request<Grade>('/grades', { method: 'POST', body });
  },

  /**
   * Правка описывает **полное** состояние обоих полей: не переданный `gradeType`
   * означает «типа нет», а не «оставить прежний» (контракт §6).
   */
  update(gradeId: number, body: { scaleCode: string; gradeType?: GradeType | null }): Promise<Grade> {
    return request<Grade>(`/grades/${gradeId}`, { method: 'PATCH', body });
  },

  /** Мягкое удаление: ответ — состояние оценки после снятия, повтор идемпотентен. */
  remove(gradeId: number): Promise<Grade> {
    return request<Grade>(`/grades/${gradeId}`, { method: 'DELETE' });
  },
};
