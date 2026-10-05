import { request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type GradeScaleValue = Schema<'GradeScaleValueView'>;
export type Grade = Schema<'GradeView'>;
export type LessonGradeSheet = Schema<'LessonGradeSheetView'>;
export type LessonGradeRow = Schema<'LessonGradeSheetRowView'>;
export type LessonGradeEntry = Schema<'LessonGradeEntryView'>;

export type GradeType = NonNullable<Grade['gradeType']>;
export type GradeWriteState = NonNullable<LessonGradeSheet['writeState']>;
export type GradeValueMode = NonNullable<LessonGradeSheet['valueMode']>;
export type SheetWorkType = Schema<'SheetWorkTypeView'>;
export type GradeValueModeInfo = Schema<'GradeValueModeView'>;

/**
 * Значение оценки — ровно одна из двух форм (GRADES-003). Какую слать, решает период:
 * лист урока и `value-mode` задания называют её в `valueMode`.
 */
export type GradeValueInput =
  | { scaleCode: string; score?: never; maxScore?: never }
  | { scaleCode?: never; score: number; maxScore?: number | null };

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
  valueFormMismatch: 'GRADE_VALUE_FORM_MISMATCH',
  scoreOutOfRange: 'GRADE_SCORE_OUT_OF_RANGE',
  maxScoreInvalid: 'GRADE_MAX_SCORE_INVALID',
  workTypeNotInPolicy: 'GRADE_WORK_TYPE_NOT_IN_POLICY',
} as const;

/**
 * Оценки урока (GRADES-001, GRADES-002).
 *
 * <p>Экран берёт лист (`sheet`), а не плоский список: в листе есть состав класса,
 * авторство каждой оценки и посчитанный ответ «можно ли сейчас писать». Собирать это
 * из четырёх запросов и выводить права на клиенте нельзя — правила окна замещающего
 * живут на сервере и меняются там же.
 *
 * <p>Значение оценки — `scaleCode` («4+») по старой шкале или `score`/`maxScore` в периоде,
 * который считается по политике оценивания (GRADES-003). Шкала и типы работ — справочники
 * с сервера, не константы клиента.
 */
export const gradesApi = {
  scale(signal?: AbortSignal): Promise<GradeScaleValue[]> {
    return request<GradeScaleValue[]>('/grades/scale', { signal });
  },

  lessonSheet(lessonId: number, signal?: AbortSignal): Promise<LessonGradeSheet> {
    return request<LessonGradeSheet>(`/lessons/${lessonId}/grades/sheet`, { signal });
  },

  create(
    body: {
      studentProfileId: number;
      sourceType: 'LESSON' | 'HOMEWORK';
      sourceId: number;
      gradeType?: GradeType | null;
    } & GradeValueInput,
  ): Promise<Grade> {
    return request<Grade>('/grades', { method: 'POST', body });
  },

  /**
   * Правка описывает **полное** состояние обоих полей: не переданный `gradeType`
   * означает «типа нет», а не «оставить прежний» (контракт §6).
   */
  update(gradeId: number, body: { gradeType?: GradeType | null } & GradeValueInput): Promise<Grade> {
    return request<Grade>(`/grades/${gradeId}`, { method: 'PATCH', body });
  },

  /** Как ставить оценку за задание: шкалой или баллом (GRADES-003). */
  homeworkValueMode(homeworkId: number, signal?: AbortSignal): Promise<GradeValueModeInfo> {
    return request<GradeValueModeInfo>(`/homework/${homeworkId}/grades/value-mode`, { signal });
  },

  /** Мягкое удаление: ответ — состояние оценки после снятия, повтор идемпотентен. */
  remove(gradeId: number): Promise<Grade> {
    return request<Grade>(`/grades/${gradeId}`, { method: 'DELETE' });
  },
};
