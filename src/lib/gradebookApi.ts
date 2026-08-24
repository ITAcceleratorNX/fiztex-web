import { pageQuery, request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type GradebookContext = Schema<'GradebookContextView'>;
export type GradebookScope = Schema<'GradebookScopeView'>;
export type GradebookPeriodRef = Schema<'GradebookPeriodRefView'>;
export type Gradebook = Schema<'GradebookView'>;
export type GradebookColumn = Schema<'GradebookColumnView'>;
export type GradebookRow = Schema<'GradebookRowView'>;
export type GradebookCell = Schema<'GradebookCellView'>;
export type GradebookSubgroup = Schema<'GradebookSubgroupView'>;

export type ClassFinalGrades = Schema<'ClassFinalGradesView'>;
export type ClassFinalGradeRow = Schema<'ClassFinalGradeRowView'>;
export type FinalGrade = Schema<'FinalGradeView'>;

/** Координаты журнала: класс, предмет и период обязательны (gradebook-read-contract §2). */
export type JournalQuery = {
  classId: number;
  subjectId: number;
  academicPeriodId: number;
  subgroupId?: number | null;
  /** Окно внутри четверти — «месяц» из макета. Границы сервер сам сужает до четверти. */
  dateFrom?: string | null;
  dateTo?: string | null;
};

/** Коды отказов итоговых оценок, на которые у экрана есть свой ответ. */
export const FINAL_GRADE_ERRORS = {
  setIncomplete: 'FINAL_GRADE_SET_INCOMPLETE',
  yearLocked: 'FINAL_GRADE_YEAR_LOCKED',
  alreadyExists: 'FINAL_GRADE_ALREADY_EXISTS',
  notAccessible: 'FINAL_GRADE_NOT_ACCESSIBLE',
} as const;

/**
 * Журнал класса и итоги за период (GRADEBOOK-001, GRADEBOOK-002).
 *
 * <p>Модуль журнала только читает: оценки создаются на уроке, итоги — своими командами.
 * Ни средних, ни рекомендаций клиент не считает — они приходят посчитанными, и второй
 * расчёт на фронте разошёлся бы с журналом на копейку и с ученическим экраном на балл.
 */
export const gradebookApi = {
  /** Чем заполнить фильтры: активный год, его периоды и доступные пары «класс + предмет». */
  context(signal?: AbortSignal): Promise<GradebookContext> {
    return request<GradebookContext>('/gradebook/context', { signal });
  },

  journal(query: JournalQuery, signal?: AbortSignal): Promise<Gradebook> {
    return request<Gradebook>(
      `/gradebook/journal${pageQuery({
        classId: query.classId,
        subjectId: query.subjectId,
        academicPeriodId: query.academicPeriodId,
        subgroupId: query.subgroupId ?? undefined,
        dateFrom: query.dateFrom ?? undefined,
        dateTo: query.dateTo ?? undefined,
      })}`,
      { signal },
    );
  },
};

export const finalGradesApi = {
  ofClass(
    query: Omit<JournalQuery, 'dateFrom' | 'dateTo'>,
    signal?: AbortSignal,
  ): Promise<ClassFinalGrades> {
    return request<ClassFinalGrades>(
      `/final-grades/class${pageQuery({
        classId: query.classId,
        subjectId: query.subjectId,
        academicPeriodId: query.academicPeriodId,
        subgroupId: query.subgroupId ?? undefined,
      })}`,
      { signal },
    );
  },

  /** Итог всегда создаётся черновиком — публикация отдельным действием (контракт §3). */
  create(body: {
    studentProfileId: number;
    subjectId: number;
    academicPeriodId: number;
    value: number;
  }): Promise<FinalGrade> {
    return request<FinalGrade>('/final-grades', {
      method: 'POST',
      body: { scope: 'PERIOD', ...body },
    });
  },

  changeValue(finalGradeId: number, value: number): Promise<FinalGrade> {
    return request<FinalGrade>(`/final-grades/${finalGradeId}`, {
      method: 'PATCH',
      body: { value },
    });
  },

  /**
   * Публикация всего набора: класс (или подгруппа) + предмет + период.
   *
   * Неполный набор сервер отклоняет целиком (409 `FINAL_GRADE_SET_INCOMPLETE` со списком
   * учеников в `details.studentProfileIds`) — частично опубликованной четверти не бывает.
   */
  publishClass(body: {
    classId: number;
    subjectId: number;
    academicPeriodId: number;
    subgroupId?: number | null;
  }): Promise<ClassFinalGrades> {
    return request<ClassFinalGrades>('/final-grades/class/publication', {
      method: 'POST',
      body: { ...body, subgroupId: body.subgroupId ?? undefined },
    });
  },
};

/** `details.studentProfileIds` из отказа публикации — читается защитно. */
export function incompleteStudentIdsFrom(details: unknown): number[] {
  if (!details || typeof details !== 'object') return [];
  const raw = (details as { studentProfileIds?: unknown }).studentProfileIds;
  return Array.isArray(raw) ? raw.filter((id): id is number => typeof id === 'number') : [];
}
