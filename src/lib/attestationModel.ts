import type { Schema } from './apiSchemas';
import type { ClassFinalGradeRow, FinalGrade } from './gradebookApi';
import { FINAL_RESULT_LABELS } from './finalGradeResult';

/**
 * Статусы аттестации ВНА / НА в итоге четверти (ATTESTATION-001, макет Figma 2209:178…5780).
 *
 * Здесь только слова и чтение того, что прислал сервер. Права, допустимые переходы,
 * обязательность причины и публикацию решает бэкенд (`docs/final-grades-contract.md` §12):
 * экран берёт признаки строки (`canEditResult`, `canChangeAttestation`, `canCorrectTechnicalError`)
 * и не вычисляет их сам. Проверка причины ниже — подсказка до отправки, а не правило: отказ
 * сервера показывается как есть.
 */

export type ResultKind = NonNullable<FinalGrade['resultKind']>;
export type AttestationKind = 'TEMP_UNATTESTED' | 'NOT_ATTESTED';
export type FinalGradeHistoryEvent = Schema<'FinalGradeHistoryView'>;
export type ResultValue = { kind: ResultKind; value: number | null };

/** Порядок в колонке «Аттестация»: сначала временный, потом окончательный. */
export const ATTESTATION_KINDS: readonly AttestationKind[] = ['TEMP_UNATTESTED', 'NOT_ATTESTED'];

export const ATTESTATION_SHORT: Record<AttestationKind, string> = {
  TEMP_UNATTESTED: 'ВНА',
  NOT_ATTESTED: 'НА',
};

/** Частые причины — заготовки поля «Причина» в окне статуса (макет 2209:672, 2209:1153). */
export const FREQUENT_REASONS: Record<AttestationKind, readonly string[]> = {
  TEMP_UNATTESTED: ['Не сдан СОЧ', 'Не сданы СОР', 'Пропуски по уважительной причине'],
  NOT_ATTESTED: ['Пропущено больше половины уроков', 'Не сданы обязательные работы'],
};

export const REASON_PLACEHOLDER = 'Например: не сдан СОЧ по уважительной причине';

/** Подпись нижней панели в режиме изменения — тот же текст отказа пришлёт сервер. */
export const PUBLISHED_EDIT_RULE =
  'Режим изменения: после публикации можно заменить только ВНА на оценку. Остальные итоги исправляет администратор';

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

/** Что стоит в строке сейчас: у опубликованной — то, что видят ученик и родитель. */
export function currentResult(grade: FinalGrade | null | undefined): ResultValue | null {
  if (!grade) return null;
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

/** Заголовок подсказки у значка причины: «Причина не аттестован» (макет 2209:178). */
export function reasonCaption(kind: AttestationKind): string {
  return `Причина ${FINAL_RESULT_LABELS[kind].toLowerCase()}`;
}

/**
 * Показывать ли значок истории: у строки со статусом всегда (Т1), у остальных — когда было что-то
 * кроме выставления и публикации. После снятия ВНА значок остаётся (Т7а): в истории есть изменение.
 */
export function hasNotableHistory(row: Pick<ClassFinalGradeRow, 'finalGrade' | 'historyCount'>): boolean {
  const grade = row.finalGrade;
  if (!grade?.id) return false;
  if (isAttestationStatus(grade.resultKind)) return true;
  const routine = grade.status === 'PUBLISHED' ? 2 : 1;
  return (row.historyCount ?? 0) > routine;
}

const ACTION_LABELS: Record<NonNullable<FinalGradeHistoryEvent['action']>, string> = {
  CREATE: 'Создание',
  UPDATE: 'Изменение',
  PUBLISH: 'Публикация',
  REPUBLISH: 'Повторная публикация',
  CONFIRM: 'Подтверждение',
  // Старые записи (до 16.11.2026): изменение ждало подтверждения учителя и семье не показывалось.
  PENDING_CHANGE: 'Изменение без публикации',
};

/** Снимок истории — объект, а не строка: старые записи без новых полей читаются как пустые. */
type Snapshot = {
  value?: number | null;
  resultKind?: ResultKind | null;
  correctionReference?: string | null;
  resultReason?: string | null;
  pendingResultKind?: ResultKind | null;
  pendingValue?: number | null;
};

export function historySnapshot(raw: unknown): Snapshot | null {
  return raw && typeof raw === 'object' ? (raw as Snapshot) : null;
}

function shownIn(snapshot: Snapshot | null): ResultValue | null {
  return snapshot ? { kind: snapshot.resultKind ?? 'NUMERIC', value: snapshot.value ?? null } : null;
}

/** У старого события «ждало подтверждения» новое значение лежит в `pending*` снимка. */
function decidedIn(snapshot: Snapshot | null): ResultValue | null {
  return snapshot?.pendingResultKind
    ? { kind: snapshot.pendingResultKind, value: snapshot.pendingValue ?? null }
    : shownIn(snapshot);
}

/** Техисправление администрации — правка с новым документом в «после» (А1). */
export function isTechnicalCorrection(event: FinalGradeHistoryEvent): boolean {
  const before = historySnapshot(event.before);
  const after = historySnapshot(event.after);
  return event.action === 'UPDATE' && Boolean(after?.correctionReference)
    && after?.correctionReference !== before?.correctionReference;
}

/** «Изменение: Временно не аттестован → 4» — строка события (макет 2209:3481). */
export function historyEventTitle(event: FinalGradeHistoryEvent): string {
  const label = isTechnicalCorrection(event)
    ? 'Исправление технической ошибки'
    : event.action ? ACTION_LABELS[event.action] : 'Событие';
  const after = historySnapshot(event.after);
  const next = event.action === 'PENDING_CHANGE' ? decidedIn(after) : shownIn(after);
  return `${label}: ${fullResultLabel(decidedIn(historySnapshot(event.before)))} → ${fullResultLabel(next)}`;
}

/** «Марина Демо · 13.01.2027, 11:20:00» — кто и когда (макет 2209:3481). */
export function historyEventAuthor(event: FinalGradeHistoryEvent): string {
  const who = event.actorName?.trim() || 'Сотрудник школы';
  if (!event.createdAt) return who;
  const at = new Date(event.createdAt);
  const date = at.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${who} · ${date}, ${time}`;
}
