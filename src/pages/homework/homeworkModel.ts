import type { Homework, RosterEntry, SubmissionStatus } from '@/lib/homeworkApi';

/**
 * Что учитель может сделать с заданием в его текущем состоянии (ТЗ FE-Teacher-002 §5, §6).
 *
 * Бэкенд — источник истины по правам, но отдельного `capabilities` у Homework нет (в отличие
 * от урока), поэтому набор действий выводится из статуса. Правило одно и живёт здесь, а не
 * в разметке: иначе кнопка «Завершить» на отменённом задании появилась бы ровно там, где
 * про неё забыли, и ошибку увидел бы не разработчик, а учитель — в виде отказа сервера.
 *
 * Отказ сервера всё равно остаётся последним словом: экран лишь не предлагает заведомо
 * недопустимое, но не разрешает ничего сверх того, что позволит бэкенд.
 */
export interface HomeworkActions {
  canEdit: boolean;
  canPublish: boolean;
  canComplete: boolean;
  canReopen: boolean;
  canCancel: boolean;
  canDelete: boolean;
  /** Проверять работы можно, пока задание не отменено (§6.4). */
  canReview: boolean;
}

export function homeworkActions(homework: Homework | undefined): HomeworkActions {
  switch (homework?.status) {
    case 'DRAFT':
      // Черновик — единственное состояние, которое можно удалить физически (HOMEWORK-001 §7).
      return { canEdit: true, canPublish: true, canComplete: false, canReopen: false,
               canCancel: false, canDelete: true, canReview: false };
    case 'PUBLISHED':
      return { canEdit: true, canPublish: false, canComplete: true, canReopen: false,
               canCancel: true, canDelete: false, canReview: true };
    case 'COMPLETED':
      return { canEdit: false, canPublish: false, canComplete: false, canReopen: true,
               canCancel: true, canDelete: false, canReview: true };
    case 'CANCELLED':
      return { canEdit: false, canPublish: false, canComplete: false, canReopen: false,
               canCancel: false, canDelete: false, canReview: false };
    default:
      return { canEdit: false, canPublish: false, canComplete: false, canReopen: false,
               canCancel: false, canDelete: false, canReview: false };
  }
}

/** Фильтры списка работ — те же, что в HOMEWORK-004 §4 и в макете 863:1004. */
export type RosterFilter = 'ALL' | 'SUBMITTED' | 'RETURNED' | 'DONE' | 'NOT_SUBMITTED';

export const ROSTER_FILTERS: Array<{ value: RosterFilter; label: string }> = [
  { value: 'ALL', label: 'Все' },
  { value: 'SUBMITTED', label: 'Отправили' },
  { value: 'RETURNED', label: 'Возвращено' },
  { value: 'DONE', label: 'Выполнено' },
  { value: 'NOT_SUBMITTED', label: 'Не отправили' },
];

/**
 * Отбор идёт на клиенте намеренно: ростер приходит целиком одним запросом и это полный
 * состав получателей, а не страница. Здесь фильтр ничего не скрывает за пределами ответа —
 * в отличие от списка заданий, где он обязан быть серверным.
 */
export function filterRoster(students: RosterEntry[], filter: RosterFilter): RosterEntry[] {
  if (filter === 'ALL') return students;
  return students.filter((s) => s.status === filter);
}

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  NOT_SUBMITTED: 'Не отправлено',
  SUBMITTED: 'Отправлено',
  RETURNED: 'Возвращено',
  DONE: 'Выполнено',
};

export const SUBMISSION_STATUS_TONES: Record<SubmissionStatus, string> = {
  NOT_SUBMITTED: 'bg-neutral-bg text-neutral-fg',
  SUBMITTED: 'bg-info-bg text-link',
  RETURNED: 'bg-attention-bg text-attention-fg',
  DONE: 'bg-success-bg text-success-fg',
};

/** Счётчик рядом с фильтром — берём из ростера, а не пересчитываем по строкам. */
export function rosterCount(
  roster: { total?: number; submitted?: number; returned?: number; done?: number; notSubmitted?: number } | undefined,
  filter: RosterFilter,
): number {
  if (!roster) return 0;
  switch (filter) {
    case 'ALL': return roster.total ?? 0;
    case 'SUBMITTED': return roster.submitted ?? 0;
    case 'RETURNED': return roster.returned ?? 0;
    case 'DONE': return roster.done ?? 0;
    case 'NOT_SUBMITTED': return roster.notSubmitted ?? 0;
  }
}
