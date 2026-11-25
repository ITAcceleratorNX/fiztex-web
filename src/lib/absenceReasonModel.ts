import type { BadgeTone } from '@/components/ui/Badge';
import type { Schema } from '@/lib/apiSchemas';
import { reasonLabel } from '@/lib/attendanceModel';
import { formatWeekdayDayMonth, pluralRu } from '@/lib/format';

/**
 * Причина отсутствия за день (ABSENCE-REASON-001, макеты К1–К16): слова и раскладка экрана
 * классного руководителя. Ничего не вычисляется: состояние дня, группа, счётчики, доступные
 * действия и причина погашенной кнопки приходят с сервера — здесь они только называются.
 */

export type AbsenceDay = Schema<'AbsenceDayDetailView'>;
export type AbsenceDayItem = Schema<'AbsenceDayItemView'>;
export type AbsenceDayStatus = NonNullable<AbsenceDay['status']>;
export type AbsenceDayGroup = NonNullable<AbsenceDayItem['group']>;
export type AbsenceResponse = Schema<'AbsenceResponseView'>;
export type AbsenceHistoryEntry = Schema<'AbsenceHistoryEntryView'>;
export type AbsenceReasonCode = NonNullable<AbsenceResponse['reason']>;
export type ParentRelation = NonNullable<Schema<'AbsenceGuardianView'>['relationType']>;
type Blocker = NonNullable<Schema<'AbsenceDayActionsView'>['requestBlockedReason']>;

/** Подписи состояний дня — те же слова, что в ТЗ: «Не указана», «Запрошена», «На проверке»… */
const STATUS: Record<AbsenceDayStatus, { label: string; tone: BadgeTone }> = {
  NOT_SPECIFIED: { label: 'Не указана', tone: 'red' },
  AWAITING_PARENT: { label: 'Запрошена', tone: 'blue' },
  AWAITING_CONFIRMATION: { label: 'На проверке', tone: 'amber' },
  CLARIFICATION_NEEDED: { label: 'Уточнение', tone: 'red' },
  CONFIRMED: { label: 'Подтверждена', tone: 'green' },
};

export function absenceStatusBadge(status: AbsenceDayStatus | null | undefined) {
  return STATUS[status ?? 'NOT_SPECIFIED'];
}

/**
 * Плашка числа ответов рядом со статусом. Она не подменяет статус дня (ТЗ): «2 ответа» добавляется к
 * «На проверке», а поздний ответ к уже подтверждённой причине — к «Подтверждена». Один ответ на
 * проверке плашки не даёт — его и так называет статус.
 */
export function pendingResponsesChip(status: AbsenceDayStatus | null | undefined, pending: number | null | undefined) {
  const count = pending ?? 0;
  if (count === 0 || (status === 'AWAITING_CONFIRMATION' && count === 1)) return null;
  return `${count} ${pluralRu(count, ['ответ', 'ответа', 'ответов'])}`;
}

/** Фильтр «Состояние» (К2а). Группы делят дни без остатка, их размер считает сервер. */
export const GROUP_OPTIONS: ReadonlyArray<{ value: AbsenceDayGroup | 'ALL'; label: string }> = [
  { value: 'ACTION_REQUIRED', label: 'Требуют действия' },
  { value: 'AWAITING_PARENT', label: 'Ожидаем родителя' },
  { value: 'CONFIRMED', label: 'Подтверждены' },
  { value: 'ALL', label: 'Все' },
];

export function groupOf(value: string | null): AbsenceDayGroup | 'ALL' {
  return GROUP_OPTIONS.find((option) => option.value === value)?.value ?? 'ACTION_REQUIRED';
}

export function groupCount(counts: Schema<'AbsenceDayCountsView'> | undefined, group: AbsenceDayGroup | 'ALL') {
  if (!counts) return null;
  switch (group) {
    case 'ACTION_REQUIRED': return counts.actionRequired ?? 0;
    case 'AWAITING_PARENT': return counts.awaitingParent ?? 0;
    case 'CONFIRMED': return counts.confirmed ?? 0;
    default: return counts.all ?? 0;
  }
}

export function lessonsCount(count: number | null | undefined): string {
  const n = count ?? 0;
  return `${n} ${pluralRu(n, ['урок', 'урока', 'уроков'])}`;
}

/** Дата урока без перевода через UTC: «2026-11-17» — это день школы, а не полночь по Гринвичу. */
export function parseSchoolDate(date: string | null | undefined): Date | null {
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/** «17.11.2026» — дата в строке списка (К2). */
export function listDate(date: string | null | undefined): string {
  const parsed = parseSchoolDate(date);
  if (!parsed) return '—';
  return `${pad(parsed.getDate())}.${pad(parsed.getMonth() + 1)}.${parsed.getFullYear()}`;
}

/** «Вторник, 17 ноября» — заголовок карточки дня. */
export function dayTitle(date: string | null | undefined): string {
  const parsed = parseSchoolDate(date);
  return parsed ? formatWeekdayDayMonth(parsed) : '—';
}

/** «18.11, 12:40» — момент события в карточке. */
export function momentLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** «17.11» — дата дня в тосте и подсказке. */
export function shortDate(date: string | null | undefined): string {
  const parsed = parseSchoolDate(date);
  return parsed ? `${pad(parsed.getDate())}.${pad(parsed.getMonth() + 1)}` : '';
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** «08:00» из «08:00:00». */
export function timeLabel(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '';
}

const RELATIONS: Record<ParentRelation, string> = {
  MOTHER: 'мама',
  FATHER: 'папа',
  GUARDIAN: 'опекун',
  OTHER: 'родственник',
};

export function relationLabel(relation: ParentRelation | null | undefined): string | null {
  return relation ? RELATIONS[relation] : null;
}

/** «Жумабаева Гульнара · мама» — подпись автора ответа. */
export function parentSignature(name: string | null | undefined, relation: ParentRelation | null | undefined): string {
  return [name || 'Родитель', relationLabel(relation)].filter(Boolean).join(' · ');
}

/** «Сапарова А.К.» из «Сапарова Айгуль Каримовна»: так учителя подписаны в карточке и истории. */
export function teacherShortName(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Классный руководитель';
  const [last, ...rest] = parts;
  const initials = rest.map((part) => `${part[0]!.toUpperCase()}.`).join('');
  return initials ? `${last} ${initials}` : last!;
}

export function quoted(text: string | null | undefined): string | null {
  const value = (text ?? '').trim();
  return value ? `«${value}»` : null;
}

/** Ответы, по которым ещё нет решения, — то, что ждёт классного руководителя. */
export function pendingResponses(day: AbsenceDay): AbsenceResponse[] {
  return (day.responses ?? []).filter((response) => response.status === 'PENDING');
}

/** Последний отклонённый ответ — что именно просили уточнить (К10). */
export function lastRejected(day: AbsenceDay): AbsenceResponse | null {
  const rejected = (day.responses ?? []).filter((response) => response.status === 'REJECTED');
  return rejected[rejected.length - 1] ?? null;
}

/** Последний запрос: когда его отправили (К6). */
export function lastRequest(day: AbsenceDay) {
  const requests = day.requests ?? [];
  return requests[requests.length - 1] ?? null;
}

/**
 * Подпись подтверждённой причины (К5, К8): кто её дал и кто подтвердил. Без глагола в прошедшем
 * времени — пол автора экран не знает, а «подтвердил(а)» читается хуже, чем «подтверждено».
 */
export function confirmedSignature(day: AbsenceDay): string {
  const reason = day.reason;
  if (!reason) return '';
  const when = momentLabel(reason.setAt);
  const teacher = teacherShortName(reason.setByName);
  if (reason.source === 'PARENT_RESPONSE') {
    const response = (day.responses ?? []).find((item) => item.responseId === reason.confirmedResponseId);
    const author = response
      ? `${response.parentName ?? 'Родитель'}${relationLabel(response.parentRelationType) ? ` (${relationLabel(response.parentRelationType)})` : ''}`
      : 'Ответ родителя';
    return [author, `подтверждено: ${teacher}`, when].filter(Boolean).join(' · ');
  }
  return [teacher, 'классный руководитель', when].filter(Boolean).join(' · ');
}

/** Строка истории (К8, К11): «Сапарова А.К.» и что сделано — безлично, без рода автора. */
export function historyLine(entry: AbsenceHistoryEntry): { actor: string; action: string } {
  const parent = entry.actorRole === 'PARENT';
  const relation = relationLabel(entry.actorRelationType);
  const actor = parent
    ? `${entry.actorName || 'Родитель'}${relation ? ` (${relation})` : ''}`
    : teacherShortName(entry.actorName);
  const reason = (value: AbsenceHistoryEntry['newReason']) => `«${reasonLabel(value ?? null)}»`;
  switch (entry.action) {
    case 'REQUEST_SENT':
      return { actor, action: 'Запрошена причина у родителя' };
    case 'RESPONSE_SUBMITTED':
      return { actor, action: `Указана причина ${reason(entry.newReason)}` };
    case 'RESPONSE_CONFIRMED':
      return { actor, action: `Подтверждена причина ${reason(entry.newReason)}` };
    case 'RESPONSE_REJECTED':
      return { actor, action: entry.note ? `Ответ отклонён: «${entry.note}»` : 'Ответ отклонён' };
    case 'REASON_SET':
      return { actor, action: `Указана причина ${reason(entry.newReason)}` };
    case 'REASON_CHANGED':
      return { actor, action: `Причина изменена: ${reason(entry.oldReason)} → ${reason(entry.newReason)}` };
    default:
      return { actor, action: 'Изменение' };
  }
}

/** «Жумабаев Е.» из «Жумабаев Ерасыл» — ученик в строке истории урока. */
export function studentShortName(fullName: string | null | undefined): string {
  const [last, first] = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!last) return '';
  return first ? `${last} ${first[0]!.toUpperCase()}.` : last;
}

/**
 * Строка истории урока о причине дня (П3): «Сапарова А.К. · Классный руководитель · Подтверждена
 * причина «Болезнь» — Жумабаев Е.». Тот же порядок, что у строк истории посещаемости.
 */
export function describeDayReasonEvent(event: Schema<'AttendanceDayReasonEventView'>): string {
  const reason = (value: AbsenceReasonCode | null | undefined) => `«${reasonLabel(value ?? null)}»`;
  const action = event.kind === 'CHANGED'
    ? `Причина изменена: ${reason(event.oldReason)} → ${reason(event.newReason)}`
    : event.kind === 'CONFIRMED'
      ? `Подтверждена причина ${reason(event.newReason)}`
      : `Указана причина ${reason(event.newReason)}`;
  return [teacherShortName(event.actorName), 'Классный руководитель', `${action} — ${studentShortName(event.studentName)}`]
    .join(' · ');
}

/** Почему кнопка погашена — тот же код, что вернула бы команда. */
const BLOCKERS: Record<Blocker, string> = {
  NO_ABSENCE: 'Пропусков в этот день больше нет — учитель исправил отметки',
  NO_LINKED_PARENT: 'К ученику не привязан родитель с активным аккаунтом',
  RESPONSES_PENDING: 'Сначала решите по ответу родителя',
  ALREADY_CONFIRMED: 'Причина уже подтверждена — её можно изменить',
  RESPONSE_PENDING: 'Ответ родителя уже на рассмотрении',
};

export function blockerText(blocker: Blocker | null | undefined): string | undefined {
  return blocker ? BLOCKERS[blocker] : undefined;
}

/** Ошибки команд по коду сервера — словами, а не «Ошибка 409». */
const COMMAND_ERRORS: Record<string, string> = {
  ABSENCE_REASON_VERSION_CONFLICT: 'Пока вы смотрели карточку, день изменился — показываем актуальное состояние. Проверьте и повторите.',
  ABSENCE_REASON_NO_ABSENCE: 'Пропусков в этот день больше нет: учитель исправил отметки. Карточка обновлена.',
  ABSENCE_REASON_NO_LINKED_PARENT: 'К ученику не привязан родитель с активным аккаунтом — укажите причину сами.',
  ABSENCE_REASON_RESPONSES_PENDING: 'Родитель уже ответил — сначала решите по ответу.',
  ABSENCE_REASON_ALREADY_CONFIRMED: 'Причина уже подтверждена — её можно изменить.',
  ABSENCE_REASON_RESPONSE_NOT_PENDING: 'По этому ответу уже приняли решение. Карточка обновлена.',
  ABSENCE_RESPONSE_NOT_FOUND: 'Ответ не найден — карточка обновлена.',
  ABSENCE_REASON_TEXT_TOO_LONG: 'Текст длиннее 500 символов — сократите его.',
  ABSENCE_REASON_UNKNOWN: 'Такой причины нет в справочнике.',
  MY_CLASS_NOT_ACCESSIBLE: 'Класс больше не закреплён за вами.',
};

export function commandErrorText(code: string | null | undefined): string {
  return (code && COMMAND_ERRORS[code]) || 'Не удалось сохранить. Проверьте соединение и повторите — введённое не потеряется.';
}

/** Коды, после которых карточку нужно перечитать: состояние на сервере уже другое. */
export function isStaleDayError(code: string | null | undefined): boolean {
  return code === 'ABSENCE_REASON_VERSION_CONFLICT'
    || code === 'ABSENCE_REASON_NO_ABSENCE'
    || code === 'ABSENCE_REASON_RESPONSES_PENDING'
    || code === 'ABSENCE_REASON_ALREADY_CONFIRMED'
    || code === 'ABSENCE_REASON_RESPONSE_NOT_PENDING'
    || code === 'ABSENCE_RESPONSE_NOT_FOUND';
}

export const COMMENT_LIMIT = 500;

/** Причина для строки списка: подтверждённая — или единственный ответ на проверке. */
export function listReason(item: AbsenceDayItem): { text: string; muted: boolean } {
  if (item.reason) return { text: reasonLabel(item.reason), muted: false };
  const latest = item.latestResponse;
  if ((item.pendingResponseCount ?? 0) === 1 && latest?.status === 'PENDING' && latest.reason) {
    return { text: reasonLabel(latest.reason), muted: false };
  }
  return { text: '—', muted: true };
}
