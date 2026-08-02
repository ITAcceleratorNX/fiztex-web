import type { LessonHistoryEntry } from '@/lib/lessonsApi';

/**
 * Журнал урока приходит машинным: тип действия плюс JSON-снимок изменения.
 * Человеческую строку («Изменено время урока: 10:00 – 10:40 (было 09:50 – 10:30)»,
 * Figma 2067:10315) собираем здесь, а не в разметке — так формулировки лежат
 * в одном месте и их видно целиком.
 *
 * Снимок разбирается защитно: журнал append-only, старые записи писались прежними
 * версиями кода и могут не иметь новых полей. Нечитаемый payload не должен ронять
 * карточку — строка просто становится короче.
 */

interface StructureSnapshot {
  startTime?: string;
  endTime?: string;
  room?: string | null;
  subjectId?: number;
  subjectName?: string;
}

interface HistoryPayload {
  before?: StructureSnapshot | string | null;
  after?: StructureSnapshot | string | null;
  reason?: string | null;
  previousReason?: string | null;
  substituteTeacherName?: string;
  mainTeacherName?: string;
}

const CANCELLATION_REASONS: Record<string, string> = {
  CALENDAR_NO_LESSONS: 'по календарю занятий нет',
  SCHEDULE_SLOT_REMOVED: 'занятие убрано из расписания',
  MANUAL: 'отменён администратором',
};

const ACTOR_ROLES: Record<string, string> = {
  ADMIN: 'Администратор',
  TEACHER: 'Учитель',
};

/** "10:00:00" → "10:00"; из бэкенда время приходит с секундами. */
export function hhmm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '—';
}

function parsePayload(raw: string | null | undefined): HistoryPayload {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as HistoryPayload) : {};
  } catch {
    return {};
  }
}

function asSnapshot(value: HistoryPayload['before']): StructureSnapshot | null {
  return value && typeof value === 'object' ? value : null;
}

function asText(value: HistoryPayload['before']): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function roomLabel(room: string | null | undefined): string {
  return room ? `каб. ${room}` : 'без кабинета';
}

/** «Изменено время урока … / Изменён кабинет … / Изменён предмет …» одной строкой. */
function describeAdminUpdate(payload: HistoryPayload): string {
  const before = asSnapshot(payload.before);
  const after = asSnapshot(payload.after);
  if (!before || !after) return 'Урок изменён администратором';

  const parts: string[] = [];
  if (before.startTime !== after.startTime || before.endTime !== after.endTime) {
    parts.push(
      `время урока: ${hhmm(after.startTime)} – ${hhmm(after.endTime)} ` +
        `(было ${hhmm(before.startTime)} – ${hhmm(before.endTime)})`,
    );
  }
  if ((before.room ?? null) !== (after.room ?? null)) {
    parts.push(`кабинет: ${roomLabel(after.room)} (было ${roomLabel(before.room)})`);
  }
  if (before.subjectId !== after.subjectId) {
    const now = after.subjectName ?? `#${after.subjectId}`;
    const was = before.subjectName ?? `#${before.subjectId}`;
    parts.push(`предмет: ${now} (было ${was})`);
  }
  if (parts.length === 0) return 'Урок изменён администратором';
  return `Изменено — ${parts.join('; ')}`;
}

function describeTopicUpdate(payload: HistoryPayload): string {
  const before = asText(payload.before);
  const after = asText(payload.after);
  if (!after) return 'Тема урока очищена';
  if (!before) return `Указана тема урока: ${after}`;
  return `Изменена тема урока: ${after} (было ${before})`;
}

export function describeHistoryEntry(entry: LessonHistoryEntry): string {
  const payload = parsePayload(entry.payload);

  switch (entry.actionType) {
    case 'CREATED':
      return 'Урок добавлен в расписание';
    case 'SUPERSEDED':
      return 'Урок заменён новой версией расписания';
    case 'CANCELLED': {
      const reason = entry.reason ? CANCELLATION_REASONS[entry.reason] : null;
      const comment = payload.reason ?? null;
      return `Урок отменён${reason ? `: ${reason}` : ''}${comment ? ` — ${comment}` : ''}`;
    }
    case 'RESTORED':
      return 'Урок восстановлен';
    case 'ADMIN_UPDATED':
      return describeAdminUpdate(payload);
    case 'SUBSTITUTE_ASSIGNED': {
      const substitute = payload.substituteTeacherName;
      const main = payload.mainTeacherName;
      if (substitute && main) return `Назначена замена: ${substitute} вместо ${main}`;
      return 'Назначена замена учителя';
    }
    case 'SUBSTITUTE_REVOKED': {
      const substitute = payload.substituteTeacherName;
      return substitute ? `Замена снята: ${substitute}` : 'Замена снята';
    }
    case 'COMMENT_CREATED':
      return 'Добавлен комментарий для учеников';
    case 'COMMENT_UPDATED':
      return 'Изменён комментарий для учеников';
    case 'COMMENT_DELETED':
      return 'Удалён комментарий для учеников';
    case 'TOPIC_UPDATED':
      return describeTopicUpdate(payload);
    default:
      return 'Изменение урока';
  }
}

/** «Администратор (Омаров Е.Л.)» или «Система» — Figma 2067:10310, 2067:10334. */
export function describeHistoryActor(entry: LessonHistoryEntry): string {
  if (entry.actorType === 'SYSTEM' || !entry.actorType) return 'Система';
  const role = ACTOR_ROLES[entry.actorType] ?? 'Пользователь';
  return entry.actorName ? `${role} (${entry.actorName})` : role;
}
