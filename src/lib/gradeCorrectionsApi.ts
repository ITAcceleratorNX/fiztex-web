import { request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import type { GradeType, GradeValueInput } from '@/lib/gradesApi';

export type GradeCorrection = Schema<'GradeCorrectionView'>;
export type GradeCorrectionHistoryEvent = Schema<'GradeCorrectionHistoryView'>;
export type GradeCorrectionStatus = NonNullable<GradeCorrection['status']>;
export type TemporaryGrade = Schema<'TemporaryGradeView'>;
export type NextLesson = Schema<'NextLessonView'>;

/** Значение временной или итоговой оценки — те же поля, что у обычной (GRADES-003). */
export type CorrectionGradeValue = GradeValueInput & { gradeType?: GradeType | null };

/**
 * Исправление работы (контракт `fiztex-back/docs/grade-correction-contract.md`).
 *
 * <p>Статус (`REQUIRED` / `OVERDUE` / …), признак истёкшего срока и события истории — включая
 * «Срок истёк» — приходят с сервера. Экран их не вычисляет: дата истечения считается по
 * полуночи школы, а не браузера.
 */
export const gradeCorrectionsApi = {
  /** Исправления урока; закрытые нужны, чтобы у завершённого показать значок истории. */
  byLesson(lessonId: number, signal?: AbortSignal): Promise<GradeCorrection[]> {
    return request<GradeCorrection[]>(`/lessons/${lessonId}/grade-corrections?includeClosed=true`, { signal });
  },

  lessonHistory(lessonId: number, signal?: AbortSignal): Promise<GradeCorrectionHistoryEvent[]> {
    return request<GradeCorrectionHistoryEvent[]>(`/lessons/${lessonId}/grade-corrections/history`, { signal });
  },

  /** Дата для «До следующего урока» — урок выбирает сервер по расписанию. */
  nextLesson(lessonId: number, signal?: AbortSignal): Promise<NextLesson> {
    return request<NextLesson>(`/lessons/${lessonId}/grade-corrections/next-lesson`, { signal });
  },

  create(
    lessonId: number,
    body: {
      studentProfileId: number;
      comment: string;
      deadline: string;
      temporaryGrade?: CorrectionGradeValue | null;
    },
  ): Promise<GradeCorrection> {
    return request<GradeCorrection>(`/lessons/${lessonId}/grade-corrections`, { method: 'POST', body });
  },

  /** Незаданное поле не меняется; снять временную оценку — `removeTemporaryGrade`. */
  update(
    correctionId: number,
    body: {
      comment?: string;
      deadline?: string;
      temporaryGrade?: CorrectionGradeValue;
      removeTemporaryGrade?: boolean;
    },
  ): Promise<GradeCorrection> {
    return request<GradeCorrection>(`/grade-corrections/${correctionId}`, { method: 'PATCH', body });
  },

  /** Итоговая оценка закрывает исправление и становится обычной оценкой урока. */
  complete(correctionId: number, body: CorrectionGradeValue): Promise<GradeCorrection> {
    return request<GradeCorrection>(`/grade-corrections/${correctionId}/complete`, { method: 'POST', body });
  },
};
