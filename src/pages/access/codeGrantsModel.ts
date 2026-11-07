import { pluralRu } from '@/lib/format';
import type { StudentCodeGrant } from '@/lib/studentCodeGrantsApi';

/**
 * Разрешения учителям выпускать персональный код (AUTH-BE-001 §7.1): срок, свод по
 * ученику и итог пакетной выдачи. Вся арифметика вынесена сюда, чтобы её можно было
 * проверить без экрана.
 */

export type ExpiryChoice = 'none' | 'yearEnd' | 'month' | 'custom';

export const EXPIRY_OPTIONS: { value: ExpiryChoice; label: string }[] = [
  { value: 'none', label: 'Без срока' },
  { value: 'yearEnd', label: 'До конца учебного года' },
  { value: 'month', label: 'На месяц' },
  { value: 'custom', label: 'До выбранной даты' },
];

export type ExpiryInput = {
  choice: ExpiryChoice;
  /** `yearEndDate` из `HomeroomCurrentView`: день, последним которым заканчивается год. */
  yearEndDate?: string | null;
  /** Значение поля `type="date"` — день в часовом поясе того, кто выдаёт. */
  customDate?: string;
  now: Date;
};

/**
 * Конец выбранного дня, а не его начало. Выбранная дата — это последний день, когда
 * разрешение ещё действует, а `expires_at` на сервере — момент; поставив полночь, мы
 * отобрали бы у учителя право в тот самый день, который администратор ему и назвал.
 *
 * Момент считается в поясе браузера: администратор работает из школы, и «конец 5 декабря»
 * для него — конец его собственного дня. Сервер хранит инстант и в пояс не вмешивается.
 */
function endOfLocalDay(day: string): string | undefined {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return undefined;
  return new Date(year, month - 1, date, 23, 59, 59, 0).toISOString();
}

/** `undefined` — «без срока»: сервер понимает отсутствие поля как бессрочное разрешение. */
export function expiresAtIso(input: ExpiryInput): string | undefined {
  if (input.choice === 'none') return undefined;
  if (input.choice === 'custom') return input.customDate ? endOfLocalDay(input.customDate) : undefined;
  if (input.choice === 'yearEnd') {
    return input.yearEndDate ? endOfLocalDay(input.yearEndDate) : undefined;
  }
  const inAMonth = new Date(input.now);
  inAMonth.setMonth(inAMonth.getMonth() + 1);
  return inAMonth.toISOString();
}

/**
 * Что мешает выдать разрешение с таким сроком. Сервер отвечает на прошедший срок ошибкой
 * «Срок разрешения уже прошёл», но спрашивать его об этом ради опечатки в дате незачем.
 */
export function expiryProblem(input: ExpiryInput): string | null {
  if (input.choice === 'custom' && !input.customDate) return 'Выберите дату';
  if (input.choice === 'yearEnd' && !input.yearEndDate) {
    return 'У класса не видно учебного года — выберите дату вручную';
  }
  const expiresAt = expiresAtIso(input);
  if (!expiresAt) return input.choice === 'none' ? null : 'Выберите дату';
  if (new Date(expiresAt).getTime() <= input.now.getTime()) return 'Эта дата уже прошла';
  return null;
}

/**
 * Действующие разрешения ученика. `active` считает сервер — «не отозвано и срок не
 * прошёл»; отозванные и истёкшие остаются в ответе историей и на экране не нужны.
 */
export function activeGrants(grants: StudentCodeGrant[] | undefined): StudentCodeGrant[] {
  return (grants ?? [])
    .filter((grant) => grant.active)
    .sort((a, b) => (a.teacherName ?? '').localeCompare(b.teacherName ?? '', 'ru'));
}

export function hasActiveGrant(grants: StudentCodeGrant[] | undefined, teacherProfileId: number): boolean {
  return activeGrants(grants).some((grant) => grant.teacherProfileId === teacherProfileId);
}

export type GrantOutcome = { granted: number; existed: number; failed: number };

/**
 * Итог пакетной выдачи одной строкой. «Уже было» — не ошибка: второго действующего
 * разрешения на пару не бывает (частичный уникальный индекс), и повторная выдача на
 * класс, где половине учеников уже открыто, обязана довести дело до конца, а не упасть.
 */
export function grantOutcomeMessage(outcome: GrantOutcome): string {
  const parts: string[] = [];
  if (outcome.granted > 0) {
    parts.push(
      `Разрешение выдано: ${outcome.granted} ${pluralRu(outcome.granted, ['ученик', 'ученика', 'учеников'])}`,
    );
  }
  if (outcome.existed > 0) {
    parts.push(
      outcome.granted > 0
        ? `у ${outcome.existed} уже было`
        : `Разрешение уже было у ${outcome.existed} ${pluralRu(outcome.existed, ['ученика', 'учеников', 'учеников'])}`,
    );
  }
  if (outcome.failed > 0) {
    parts.push(
      `не удалось у ${outcome.failed} ${pluralRu(outcome.failed, ['ученика', 'учеников', 'учеников'])}`,
    );
  }
  return parts.length > 0 ? `${parts.join(', ')}.` : 'Никого не выбрали.';
}
