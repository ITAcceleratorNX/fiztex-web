import type { AssessmentResultEvent } from '@/lib/assessmentWorksApi';

/**
 * Слова и проверки исправления балла СОЧ (ТЗ «Исправление результатов СОЧ»).
 *
 * <p>Проверки здесь — подсказка до отправки: кнопка не включается с пустой причиной или баллом
 * вне диапазона. Решает всё равно сервер (`ASSESSMENT_CORRECTION_REASON_REQUIRED`,
 * `ASSESSMENT_SCORE_OUT_OF_RANGE`); правило причины то же — не меньше трёх букв или цифр.
 */

export const REASON_MAX_LENGTH = 500;
const REASON_MIN_SIGNS = 3;

/** «31 / 40»; нет строки результата — балл не выставлен, и это не 0. */
export function scoreLabel(score: number | null | undefined, maxScore: number | null | undefined): string {
  if (score == null) return '—';
  return maxScore != null ? `${score} / ${maxScore}` : String(score);
}

export function hasMeaningfulReason(reason: string): boolean {
  let signs = 0;
  for (const char of reason) {
    if (/[\p{L}\p{N}]/u.test(char)) signs += 1;
    if (signs >= REASON_MIN_SIGNS) return true;
  }
  return false;
}

/**
 * Что мешает сохранить исправление, словами; `null` — можно отправлять.
 *
 * @param input балл — то, что набрал пользователь (строка поля)
 */
export function correctionProblem(input: {
  score: string;
  reason: string;
  currentScore: number;
  maxScore: number;
}): string | null {
  const text = input.score.trim();
  if (text === '') return 'Введите новый балл';
  const value = Number(text.replace(',', '.'));
  if (!Number.isInteger(value)) return 'Балл — целое число';
  if (value < 0) return 'Балл не может быть отрицательным';
  if (value > input.maxScore) return `Балл не может быть больше ${input.maxScore}`;
  if (value === input.currentScore) return 'Балл не изменился';
  if (!hasMeaningfulReason(input.reason)) return 'Укажите причину исправления';
  return null;
}

/** «Было 20 → стало 31» — строка события истории; первичная выставка — «Выставлено». */
export function resultEventTitle(event: AssessmentResultEvent, maxScore?: number | null): string {
  const after = scoreLabel(event.scoreAfter, maxScore);
  return event.scoreBefore == null
    ? `Выставлено: ${after}`
    : `Исправлено: ${scoreLabel(event.scoreBefore, maxScore)} → ${after}`;
}

const ROLE_LABELS: Record<string, string> = {
  TEACHER: 'Учитель',
  ADMIN: 'Администратор',
  SUPER_ADMIN: 'Администратор',
};

export function resultEventActor(event: AssessmentResultEvent): string {
  const role = event.actorRole ? ROLE_LABELS[event.actorRole] : null;
  const name = event.actorName ?? 'Сотрудник школы';
  return role ? `${name} · ${role}` : name;
}
