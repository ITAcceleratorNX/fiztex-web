import { pageQuery, request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

/**
 * Поля списка, которых пока нет в сгенерированных типах.
 *
 * `api-types.ts` снят с ветки бэкенда, где работа HOMEWORK-005.1 ещё не влита: там у
 * `HomeworkView` нет ни подписей, ни прогресса. Дописывать их в сгенерированный файл
 * нельзя — он перегенерируется и правки затрутся, — поэтому расширение объявлено здесь
 * и живёт ровно до первого `pnpm gen:api` по слитому бэкенду: после него эти поля
 * приедут сами, и весь блок нужно удалить.
 *
 * Контракт полей — `HomeworkDtos.HomeworkView` (ТЗ HOMEWORK-005.1 §4.2).
 */
export interface HomeworkProgress {
  /** Уникальные ученики, отправившие работу хотя бы один раз. */
  submitted?: number;
  /** Все активные получатели задания. */
  total?: number;
  /** Отправки, ждущие решения учителя. */
  pendingReview?: number;
}

export interface HomeworkLessonRef {
  id?: number;
  lessonDate?: string;
  lessonNumber?: number;
}

interface HomeworkListFields {
  className?: string;
  subjectName?: string;
  subgroupName?: string;
  lesson?: HomeworkLessonRef;
  progress?: HomeworkProgress;
}

export type Homework = Schema<'HomeworkView'> & HomeworkListFields;
export type HomeworkStatus = NonNullable<Homework['status']>;

type HomeworkPage = Schema<'PageHomeworkView'>;

/** Вкладка списка: набор статусов, а не отдельный ресурс (ТЗ HOMEWORK-005.1 §4.1). */
export type HomeworkScope = 'ACTUAL' | 'HISTORY';

export interface HomeworkListParams {
  scope: HomeworkScope;
  /** Статусы внутри вкладки; бэк пересекает их с вкладкой, а не заменяет ею. */
  statuses?: HomeworkStatus[];
  classId?: number;
  subgroupId?: number;
  subjectId?: number;
  lessonId?: number;
  /** Период по сроку сдачи, ISO. Задания без срока в период не попадают. */
  dueFrom?: string;
  dueTo?: string;
  pendingReviewOnly?: boolean;
  page?: number;
  size?: number;
}

/**
 * Домашние задания учителя (HomeworkController).
 *
 * Фильтрация целиком серверная (ТЗ §7): доотбирать пришедшую страницу на клиенте нельзя —
 * на второй странице выдача была бы другой, а «сдали / всего» посчитан по всем получателям,
 * а не по тому, что попало в ответ.
 */
export const homeworkApi = {
  list(params: HomeworkListParams, signal?: AbortSignal): Promise<HomeworkPage> {
    const { statuses, ...rest } = params;
    // Повторяющийся `statuses` — множество на бэке, поэтому ключ дублируется, а не
    // склеивается запятой: Spring разбирает именно повторы.
    const repeated = (statuses ?? []).map((status) => `statuses=${status}`).join('&');
    const query = pageQuery({ ...rest });
    const separator = query ? '&' : '?';
    return request<HomeworkPage>(
      `/homework${query}${repeated ? separator + repeated : ''}`,
      { signal },
    );
  },

  card(homeworkId: number, signal?: AbortSignal): Promise<Homework> {
    return request<Homework>(`/homework/${homeworkId}`, { signal });
  },
};

/** Статусы, которые фильтр предлагает на каждой вкладке (§4.1). */
export const SCOPE_STATUSES: Record<HomeworkScope, HomeworkStatus[]> = {
  ACTUAL: ['DRAFT', 'PUBLISHED'],
  HISTORY: ['COMPLETED', 'CANCELLED'],
};
