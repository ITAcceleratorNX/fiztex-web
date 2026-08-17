import type {
  AttendanceHistoryEntry,
  AttendanceMark,
  AttendanceMarking,
  AttendanceReason,
  AttendanceSheet,
  AttendanceStatus,
} from '@/lib/attendanceApi';

/**
 * Правила отметки посещаемости одним местом на весь веб.
 *
 * Модель бэка трёхчастная — `status` + `mark` + `reason`, и допустимы не все
 * сочетания (`attendance-read-contract.md` §2): причина бывает только у отсутствия,
 * «опоздал» только у присутствия, «освобождён» только у отсутствия. Это проверяют и
 * домен, и CHECK-и в БД, поэтому собирать недопустимую пару в интерфейсе — значит
 * получить 400 на сохранении там, где виноват не пользователь.
 */

export type StatusTone = 'present' | 'absent' | 'muted';

export const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string; tone: StatusTone }> = [
  { value: 'PRESENT', label: 'Присутствовал', tone: 'present' },
  { value: 'ABSENT', label: 'Отсутствовал', tone: 'absent' },
  { value: 'NOT_MARKED', label: 'Не отмечено', tone: 'muted' },
];

/**
 * Причина отсутствия. «Не указана» — это `null`, а не значение справочника: одно
 * состояние не должно выражаться двумя способами. Освобождения в списке нет — это
 * дополнительная отметка (`mark = EXCUSED`), а не причина.
 */
export const REASON_OPTIONS: Array<{ value: AttendanceReason | null; label: string }> = [
  { value: null, label: 'Не указана' },
  { value: 'ILLNESS', label: 'Болезнь' },
  { value: 'FAMILY', label: 'Семейные обстоятельства' },
  { value: 'SCHOOL_EVENT', label: 'Школьное мероприятие' },
  { value: 'COMPETITION', label: 'Соревнования' },
  { value: 'TRANSPORT', label: 'Транспорт' },
  { value: 'UNEXCUSED', label: 'Без уважительной причины' },
  { value: 'OTHER', label: 'Другое' },
];

const STATUS_BY_VALUE = new Map(STATUS_OPTIONS.map((option) => [option.value, option]));

/**
 * Пустая отметка. Поля не «стираются в `null`», а отсутствуют: сгенерированные типы
 * знают только `undefined` (springdoc не описывает nullability Java-полей), а
 * `JSON.stringify` выбрасывает такие ключи — запись без поля бэкенд читает как `null`.
 * Читать при этом приходится терпимо: в ответе те же поля приходят именно `null`.
 */
export const NOT_MARKED: AttendanceMarking = { status: 'NOT_MARKED' };

export function statusOf(marking: AttendanceMarking | null | undefined): AttendanceStatus {
  return marking?.status ?? 'NOT_MARKED';
}

/** Подпись и тон чипа статуса. Пустая отметка читается как «не отмечено». */
export function statusChip(marking: AttendanceMarking | null | undefined) {
  return STATUS_BY_VALUE.get(statusOf(marking)) ?? STATUS_OPTIONS[2];
}

/**
 * Дополнительная отметка, допустимая при этом статусе: `LATE` у присутствия,
 * `EXCUSED` у отсутствия. `null` там, где галочки нет вовсе, — так колонка «доп.
 * отметка» не решает сама, что показать, и не расходится с CHECK-ами базы.
 */
export function markToggleFor(
  status: AttendanceStatus,
): { value: AttendanceMark; label: string } | null {
  if (status === 'PRESENT') return { value: 'LATE', label: 'Опоздал' };
  if (status === 'ABSENT') return { value: 'EXCUSED', label: 'Освобождён' };
  return null;
}

export function reasonLabel(reason: AttendanceReason | null | undefined): string {
  return REASON_OPTIONS.find((option) => option.value === (reason ?? null))?.label ?? 'Не указана';
}

/**
 * Смена статуса чистит то, что при новом статусе недопустимо: у присутствия нет
 * причины, у «не отмечено» — ни отметки, ни причины.
 *
 * Комментарий переживает смену статуса: он про ученика, а не про статус.
 */
export function withStatus(
  marking: AttendanceMarking | null | undefined,
  status: AttendanceStatus,
): AttendanceMarking {
  const base = { ...(marking ?? NOT_MARKED), status };
  if (status === 'NOT_MARKED') return { ...base, mark: undefined, reason: undefined };
  if (status === 'PRESENT') {
    return { ...base, mark: marking?.mark === 'LATE' ? 'LATE' : undefined, reason: undefined };
  }
  return { ...base, mark: marking?.mark === 'EXCUSED' ? 'EXCUSED' : undefined };
}

/** Переключение галочки «опоздал» / «освобождён» — только той, что положена статусу. */
export function withMarkToggled(marking: AttendanceMarking | null | undefined): AttendanceMarking {
  const current = marking ?? NOT_MARKED;
  const toggle = markToggleFor(statusOf(current));
  if (!toggle) return current;
  return { ...current, mark: current.mark === toggle.value ? undefined : toggle.value };
}

export function withReason(
  marking: AttendanceMarking | null | undefined,
  reason: AttendanceReason | null,
): AttendanceMarking {
  return { ...(marking ?? NOT_MARKED), reason: reason ?? undefined };
}

export function withComment(
  marking: AttendanceMarking | null | undefined,
  comment: string,
): AttendanceMarking {
  const trimmed = comment.trim();
  return { ...(marking ?? NOT_MARKED), comment: trimmed === '' ? undefined : trimmed };
}

/** Две отметки различаются по значению — иначе строку незачем отправлять. */
export function sameMarking(
  a: AttendanceMarking | null | undefined,
  b: AttendanceMarking | null | undefined,
): boolean {
  return (
    statusOf(a) === statusOf(b) &&
    (a?.mark ?? null) === (b?.mark ?? null) &&
    (a?.reason ?? null) === (b?.reason ?? null) &&
    (a?.comment ?? '').trim() === (b?.comment ?? '').trim()
  );
}

export function isMarked(marking: AttendanceMarking | null | undefined): boolean {
  return statusOf(marking) !== 'NOT_MARKED';
}

/**
 * Бейдж состояния листа в шапке урока (Figma `lesson-header-card`).
 *
 * «Есть правки» названо отдельно от «Опубликовано»: ученик в этот момент видит
 * предыдущую версию, и умолчать об этом значило бы дать администратору думать, что
 * правка уже дошла.
 */
export function sheetBadge(
  sheet: AttendanceSheet | undefined,
  options: { cancelled?: boolean } = {},
): string {
  if (options.cancelled || sheet?.state === 'ANNULLED') return 'Недоступна';
  if (sheet?.state === 'PUBLISHED') {
    return sheet.hasUnpublishedChanges ? 'Есть правки' : 'Опубликовано';
  }
  if (sheet?.state === 'DRAFT') return 'Черновик';
  return 'Не заполнено';
}

const HISTORY_ACTIONS: Record<string, string> = {
  DRAFT_SAVED: 'Сохранён черновик',
  BULK_PRESENT: 'Отмечены все присутствующие',
  PUBLISHED: 'Опубликована посещаемость',
  REPUBLISHED: 'Посещаемость опубликована повторно',
  ANNULLED: 'Урок отменён',
  RESTORED: 'Урок восстановлен',
};

const HISTORY_ROLES: Record<string, string> = {
  SYSTEM: 'Система',
  ADMIN: 'Администратор',
  MAIN_TEACHER: 'Учитель',
  SUBSTITUTE_TEACHER: 'Замена',
};

/**
 * Строка истории: «Иванова М.В. · Учитель · Сохранён черновик · Петров М.Н.».
 *
 * Имя автора и роль вместе, как в макете: у одного урока бывает и основной учитель,
 * и замещающий, и админ — по одной роли их не различить, по одному имени не понять,
 * в каком качестве человек правил.
 */
export function describeAttendanceHistory(entry: AttendanceHistoryEntry): string {
  const role = HISTORY_ROLES[entry.actorRole ?? 'SYSTEM'] ?? 'Система';
  const action = HISTORY_ACTIONS[entry.action ?? ''] ?? 'Изменение';
  return [entry.actorName, role, action, entry.studentName].filter(Boolean).join(' · ');
}
