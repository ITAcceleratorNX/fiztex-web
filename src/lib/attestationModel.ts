import type { Schema } from './apiSchemas';
import type { FinalGrade } from './gradebookApi';
import type { BadgeTone } from '@/components/ui/Badge';
import { FINAL_RESULT_LABELS } from './finalGradeResult';

/**
 * Статусы аттестации ВНА / НА в итоге четверти (ATTESTATION-001).
 *
 * Здесь только слова и чтение того, что прислал сервер. Права, допустимые переходы,
 * обязательность причины и публикацию решает бэкенд (`docs/final-grades-contract.md` §12):
 * экран берёт признаки строки (`canEditResult`, `canChangeAttestation`,
 * `canConfirmPublication`) и не вычисляет их сам. Проверка причины ниже — подсказка до
 * отправки, а не правило: отказ сервера показывается как есть.
 */

export type ResultKind = NonNullable<FinalGrade['resultKind']>;
export type AttestationKind = 'TEMP_UNATTESTED' | 'NOT_ATTESTED';
export type PendingChange = Schema<'PendingChangeView'>;
export type FinalGradeHistoryEvent = Schema<'FinalGradeHistoryView'>;

/** Порядок кнопок в селекторе: сначала временный, потом окончательный. */
export const ATTESTATION_KINDS: readonly AttestationKind[] = ['TEMP_UNATTESTED', 'NOT_ATTESTED'];

export const ATTESTATION_SHORT: Record<AttestationKind, string> = {
  TEMP_UNATTESTED: 'ВНА',
  NOT_ATTESTED: 'НА',
};

/** Расшифровка для легенды и окна статуса: что статус значит и чем он снимается. */
export const ATTESTATION_HINT: Record<AttestationKind, string> = {
  TEMP_UNATTESTED:
    'Итог отложен: обязательные работы ещё не сданы. Снимается оценкой, когда работы сданы, — с причиной.',
  NOT_ATTESTED:
    'Решение за четверть: ученик не аттестован. Изменить его можно только вручную, с причиной.',
};

/**
 * Частые причины — заготовки поля «Причина» (вопрос В6 разбора). Макета у них нет:
 * список — предположение до согласования, и правится он здесь одной константой.
 */
export const FREQUENT_REASONS: readonly string[] = [
  'Пропуски по уважительной причине',
  'Не выполнены СОР/СОЧ',
  'Длительная болезнь',
  'Прибыл из другой школы',
];

/** Совпадает с сервером (`AttestationStatusRules`), но отказ всё равно приходит от него. */
export const REASON_MIN = 5;
export const REASON_MAX = 1000;

export function isAttestationStatus(kind: ResultKind | null | undefined): kind is AttestationKind {
  return kind === 'TEMP_UNATTESTED' || kind === 'NOT_ATTESTED';
}

/** Подсказка к полю причины: `null` — можно отправлять. */
export function reasonProblem(reason: string): string | null {
  const length = reason.trim().length;
  if (length < REASON_MIN) return `Укажите причину — не короче ${REASON_MIN} символов`;
  if (length > REASON_MAX) return `Причина длиннее ${REASON_MAX} символов`;
  return null;
}

/**
 * Нужна ли причина у этого выбора: статус был до или будет после. Решает, открывать ли окно
 * перед отправкой; сервер проверит то же самое (`FINAL_GRADE_REASON_REQUIRED`).
 */
export function needsReason(current: ResultKind | null | undefined, next: ResultKind): boolean {
  return isAttestationStatus(current) || isAttestationStatus(next);
}

export type ResultValue = { kind: ResultKind; value: number | null };

/** Что решено сейчас: ожидающее изменение, если оно есть, иначе сам итог. */
export function decidedResult(grade: FinalGrade | null | undefined): ResultValue | null {
  if (!grade) return null;
  const pending = grade.pendingChange;
  if (pending?.resultKind) return { kind: pending.resultKind, value: pending.value ?? null };
  return { kind: grade.resultKind ?? 'NUMERIC', value: grade.value ?? null };
}

/** «7», «ВНА», «Зачёт» — коротко, для ячейки. */
export function shortResultLabel(result: ResultValue | null | undefined): string {
  if (!result) return '—';
  if (isAttestationStatus(result.kind)) return ATTESTATION_SHORT[result.kind];
  if (result.kind === 'NUMERIC') return result.value != null ? String(result.value) : '—';
  return FINAL_RESULT_LABELS[result.kind];
}

/** «7», «Временно не аттестован» — полностью, для текста. */
export function fullResultLabel(result: ResultValue | null | undefined): string {
  if (!result) return '—';
  if (result.kind === 'NUMERIC') return result.value != null ? String(result.value) : '—';
  return FINAL_RESULT_LABELS[result.kind];
}

/** То, что видят ученик и родитель, — только у опубликованного итога. */
export function familySees(grade: FinalGrade | null | undefined): ResultValue | null {
  if (!grade || grade.status !== 'PUBLISHED') return null;
  return { kind: grade.resultKind ?? 'NUMERIC', value: grade.value ?? null };
}

export type PublicationBadge = { label: string; tone: BadgeTone };

/**
 * Состояние публикации строки (ТЗ-2 §5): черновик / опубликовано / изменено после публикации.
 * Состояние присылает сервер; у старых ответов без него — выводится из `status`.
 */
export function publicationBadge(grade: FinalGrade | null | undefined): PublicationBadge | null {
  if (!grade) return null;
  const state = grade.publicationState
    ?? (grade.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT');
  switch (state) {
    case 'DRAFT':
      return { label: 'Черновик', tone: 'gray' };
    case 'PUBLISHED':
      return { label: 'Опубликовано', tone: 'green' };
    case 'CHANGED_AFTER_PUBLICATION':
      return { label: 'Изменено после публикации', tone: 'amber' };
  }
}

const ROLE_LABELS: Partial<Record<NonNullable<FinalGradeHistoryEvent['actorRole']>, string>> = {
  TEACHER: 'Учитель',
  ADMIN: 'Администрация',
  SUPER_ADMIN: 'Администрация',
};

/** «Иванова А. · Администрация» — кто изменил; роль важна, потому что подтверждает учитель. */
export function authorLabel(name: string | null | undefined, role: FinalGradeHistoryEvent['actorRole']): string {
  const who = name?.trim() || 'Сотрудник школы';
  const roleLabel = role ? ROLE_LABELS[role] : undefined;
  return roleLabel ? `${who} · ${roleLabel}` : who;
}

const ACTION_LABELS: Record<NonNullable<FinalGradeHistoryEvent['action']>, string> = {
  CREATE: 'Выставлено',
  UPDATE: 'Изменено',
  PUBLISH: 'Опубликовано',
  REPUBLISH: 'Повторно опубликовано',
  PENDING_CHANGE: 'Изменено после публикации',
};

export function historyActionLabel(action: FinalGradeHistoryEvent['action']): string {
  return action ? ACTION_LABELS[action] : 'Событие';
}

/** Снимок истории — объект, а не строка: старые записи без новых полей читаются как пустые. */
type Snapshot = {
  value?: number | null;
  resultKind?: ResultKind | null;
  pendingResultKind?: ResultKind | null;
  pendingValue?: number | null;
};

function asSnapshot(raw: unknown): Snapshot | null {
  return raw && typeof raw === 'object' ? (raw as Snapshot) : null;
}

/** Что видели ученик и родитель в момент снимка (основные поля). */
function shownIn(snapshot: Snapshot | null): ResultValue | null {
  return snapshot ? { kind: snapshot.resultKind ?? 'NUMERIC', value: snapshot.value ?? null } : null;
}

/** Что было решено в момент снимка: ожидающее, если было, иначе показанное. */
function decidedIn(snapshot: Snapshot | null): ResultValue | null {
  if (snapshot?.pendingResultKind) {
    return { kind: snapshot.pendingResultKind, value: snapshot.pendingValue ?? null };
  }
  return shownIn(snapshot);
}

/**
 * Строка события истории (ТЗ-2 §4: «исходное → новое значение»).
 *
 * У изменения после публикации «было → стало» — решение школы, а не то, что видел ученик:
 * «ВНА → 7», а не «ВНА → ВНА». Отмена ожидающего изменения названа отдельно, иначе она
 * выглядела бы как ещё одно изменение. Снимки до ATTESTATION-001 ожидающего не знают и
 * читаются как обычные.
 */
export function historyEventTitle(event: FinalGradeHistoryEvent): string {
  const before = asSnapshot(event.before);
  const after = asSnapshot(event.after);
  switch (event.action) {
    case 'CREATE':
    case 'PUBLISH':
      return `${historyActionLabel(event.action)}: ${shortResultLabel(shownIn(after))}`;
    case 'PENDING_CHANGE':
      return after?.pendingResultKind
        ? `Изменено после публикации: ${shortResultLabel(decidedIn(before))} → ${shortResultLabel(decidedIn(after))}`
        : `Изменение после публикации отменено: ${shortResultLabel(decidedIn(before))} → ${shortResultLabel(shownIn(after))}`;
    default:
      return `${historyActionLabel(event.action)}: ${shortResultLabel(shownIn(before))} → ${shortResultLabel(shownIn(after))}`;
  }
}

/** Пояснение под событием, которое ещё не дошло до семьи. */
export function historyEventNote(event: FinalGradeHistoryEvent): string | null {
  return event.action === 'PENDING_CHANGE' && asSnapshot(event.after)?.pendingResultKind
    ? 'Ученик и родитель видели прежнее значение до повторной публикации'
    : null;
}
