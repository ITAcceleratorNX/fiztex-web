import type { AssessmentKind, AssessmentLimits, AssessmentWork } from '@/lib/assessmentWorksApi';

/**
 * Слова и правила интерфейса работ СОР/СОЧ (ТЗ Frontend «СОР/СОЧ в расписании и журнале»).
 *
 * <p>Здесь ничего не решается по существу: лимиты, статусы, «можно ли перенести» приходят от
 * бэкенда (`docs/assessment-work-contract.md`). Модуль называет состояния и объясняет отказ до
 * попытки — чтобы недоступное действие показывалось с причиной, а не просто серым.
 */

export const KIND_LABELS: Record<AssessmentKind, string> = { SOR: 'СОР', SOCH: 'СОЧ' };

export const REMINDER_OPTIONS = [
  { days: 1, label: 'За 1 день' },
  { days: 3, label: 'За 3 дня' },
  { days: 0, label: 'Не напоминать' },
] as const;

/** «СОР 2» / «СОЧ»: номер у СОР пересчитывается сервером, поэтому на него не ссылаются. */
export function workTitle(work: Pick<AssessmentWork, 'kind' | 'number'>): string {
  if (work.kind === 'SOCH') return 'СОЧ';
  return work.number != null ? `СОР ${work.number}` : 'СОР';
}

export function reminderLabel(days: number | null | undefined): string {
  if (days == null) return '—';
  const known = REMINDER_OPTIONS.find((option) => option.days === days);
  if (known) return known.label;
  return `За ${days} дн.`;
}

/**
 * Статус словами сервера: «Запланирована», «Проведена», «Баллы выставлены», «Отменена».
 * От даты не зависит — работа «проведена» только по явному действию учителя.
 */
export function workStateLabel(work: Pick<AssessmentWork, 'status' | 'hasResults'>): string {
  if (work.status === 'CANCELLED') return 'Отменена';
  if (work.hasResults) return 'Баллы выставлены';
  if (work.status === 'CONDUCTED') return 'Проведена';
  return 'Запланирована';
}

/** Максимум, перенос и отмена закрываются первым баллом (контракт §2). */
export function isLockedByResults(work: Pick<AssessmentWork, 'hasResults'>): boolean {
  return work.hasResults === true;
}

/**
 * Перенос — только запланированной работы и только без баллов (контракт §2): проведённую работу
 * на другую дату не переносят, она уже состоялась. Сервер отвечает 409 `ASSESSMENT_NOT_PLANNED`.
 */
export function canReschedule(work: Pick<AssessmentWork, 'status' | 'hasResults'>): boolean {
  return work.status === 'PLANNED' && work.hasResults !== true;
}

/** Отмена — из любого статуса, кроме отменённой, и только без баллов. */
export function canCancel(work: Pick<AssessmentWork, 'status' | 'hasResults'>): boolean {
  return work.status !== 'CANCELLED' && work.hasResults !== true;
}

export const CONDUCTED_MOVE_HINT = 'Проведённую работу на другую дату не переносят — её можно только отменить';
export const LOCKED_HINT = 'Перенести или отменить работу после выставления баллов нельзя';
export const MAX_LOCKED_HINT = 'Максимум нельзя менять после выставления первого балла';

/** Что мешает назначить работу этого вида; `null` — можно. Окончательно решает сервер. */
export function kindUnavailableReason(kind: AssessmentKind, limits: AssessmentLimits | null | undefined): string | null {
  if (!limits) return null;
  if (kind === 'SOR') {
    if (limits.sorAllowed === false) return 'СОР не предусмотрен в политике оценивания этой четверти';
    if ((limits.sorUsed ?? 0) >= (limits.sorLimit ?? 0)) {
      return `Лимит СОР исчерпан: в четверти ${limits.sorLimit}, назначено ${limits.sorUsed}`;
    }
    return null;
  }
  if (limits.sochAllowed === false) return 'СОЧ не предусмотрен в политике оценивания этой четверти';
  if ((limits.sochUsed ?? 0) >= 1) return 'В этой четверти уже назначен СОЧ — он один на предмет';
  return null;
}

/** «Будет СОР 2: в четверти 3 СОР, назначен 1» — подсказка под выбором типа. */
export function nextWorkHint(kind: AssessmentKind, limits: AssessmentLimits | null | undefined): string | null {
  if (!limits || kind !== 'SOR' || kindUnavailableReason(kind, limits)) return null;
  const used = limits.sorUsed ?? 0;
  return `Будет СОР ${used + 1}: в четверти ${limits.sorLimit} СОР, назначено ${used}`;
}

/** Максимум — целое 1…1000, как проверяет сервер; `null` — подходит. */
export function maxScoreProblem(text: string): string | null {
  const value = text.trim();
  if (value === '') return 'Введите максимальный балл';
  if (!/^\d+$/.test(value)) return 'Максимальный балл — целое число больше 0';
  const number = Number(value);
  if (number < 1) return 'Максимальный балл должен быть больше 0';
  if (number > 1000) return 'Максимальный балл — не больше 1000';
  return null;
}

/** Работа, по которой ещё можно что-то делать (не отменена). */
export function activeWorks(works: AssessmentWork[] | undefined): AssessmentWork[] {
  return (works ?? []).filter((work) => work.status !== 'CANCELLED');
}
