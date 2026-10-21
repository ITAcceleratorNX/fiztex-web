import type { LessonHistoryEntry } from '@/lib/lessonsApi';
import { pagesLabel } from '@/lib/textbookModel';

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
  comment?: string | null;
  previousReason?: string | null;
  substituteTeacherName?: string;
  mainTeacherName?: string;
  /** Заголовок задания модуля ДЗ или учебника, о котором событие. */
  title?: string | null;
  /** Страницы выбранного учебника (LIBRARY-BE-001 §6). */
  pageFrom?: number | null;
  pageTo?: number | null;
  /** Откуда перенесена подготовка (PREPARATION_COPIED). */
  sourceLessonDate?: string | null;
  sourceClassName?: string | null;
  fileName?: string | null;
  visibleToStudents?: boolean;
}

const CANCELLATION_REASONS: Record<string, string> = {
  CALENDAR_NO_LESSONS: 'Урок отменён автоматически: по календарю занятий нет',
  SCHEDULE_SLOT_REMOVED: 'Урок отменён автоматически: занятие убрано из расписания',
  MANUAL: 'Урок отменён администратором',
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
    const payload = asObject(parsed);
    if (!payload) return {};
    return {
      before: typeof payload.before === 'string' ? payload.before : asSnapshot(payload.before),
      after: typeof payload.after === 'string' ? payload.after : asSnapshot(payload.after),
      reason: asText(payload.reason), comment: asText(payload.comment),
      substituteTeacherName: asText(payload.substituteTeacherName) ?? undefined,
      mainTeacherName: asText(payload.mainTeacherName) ?? undefined,
      title: asText(payload.title), fileName: asText(payload.fileName),
      pageFrom: typeof payload.pageFrom === 'number' ? payload.pageFrom : null,
      pageTo: typeof payload.pageTo === 'number' ? payload.pageTo : null,
      sourceLessonDate: asText(payload.sourceLessonDate), sourceClassName: asText(payload.sourceClassName),
      visibleToStudents: typeof payload.visibleToStudents === 'boolean' ? payload.visibleToStudents : undefined,
    };
  } catch {
    return {};
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asSnapshot(value: unknown): StructureSnapshot | null {
  const snapshot = asObject(value);
  if (!snapshot) return null;
  return {
    startTime: asText(snapshot.startTime) ?? undefined, endTime: asText(snapshot.endTime) ?? undefined,
    room: asText(snapshot.room), subjectName: asText(snapshot.subjectName) ?? undefined,
    subjectId: typeof snapshot.subjectId === 'number' ? snapshot.subjectId : undefined,
  };
}

function asText(value: unknown): string | null {
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
    const now = after.subjectName;
    const was = before.subjectName;
    parts.push(now ? `предмет: ${now}${was ? ` (было ${was})` : ''}` : 'предмет');
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

/** Заголовок задания приписывается, если он в снимке есть: события старше его не писали. */
function withTitle(text: string, payload: HistoryPayload): string {
  const title = payload.title?.trim();
  return title ? `${text}: ${title}` : text;
}

function describeCancellation(entry: LessonHistoryEntry, payload: HistoryPayload): string {
  // Older entries duplicated the enum in payload.reason; it is not a comment.
  const code = entry.reason ?? payload.reason;
  const label = code && Object.prototype.hasOwnProperty.call(CANCELLATION_REASONS, code) ? CANCELLATION_REASONS[code] : 'Урок отменён';
  const legacyReason = payload.reason;
  const technicalReason = legacyReason && (legacyReason === entry.reason || Object.prototype.hasOwnProperty.call(CANCELLATION_REASONS, legacyReason)
    || /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(legacyReason));
  const comment = payload.comment ?? (technicalReason ? null : legacyReason);
  return label + (comment ? ` — ${comment}` : '');
}

export function describeHistoryEntry(entry: LessonHistoryEntry): string {
  const payload = parsePayload(entry.payload);

  switch (entry.actionType) {
    case 'CREATED':
      return 'Урок добавлен в расписание';
    case 'SUPERSEDED':
      return 'Урок заменён новой версией расписания';
    case 'CANCELLED':
      return describeCancellation(entry, payload);
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
    case 'GRADE_PERMISSION_GRANTED':
      return 'Замещающему учителю разрешено выставлять и изменять оценки';
    case 'GRADE_PERMISSION_REVOKED':
      return 'У замещающего учителя отозвано право выставлять и изменять оценки';
    case 'COMMENT_CREATED':
      return 'Добавлен комментарий для учеников';
    case 'COMMENT_UPDATED':
      return 'Изменён комментарий для учеников';
    case 'COMMENT_DELETED':
      return 'Удалён комментарий для учеников';
    case 'TOPIC_UPDATED':
      return describeTopicUpdate(payload);
    case 'PREPARATION_APPLIED':
      return 'Применена заготовка урока';
    case 'PREPARATION_COPIED':
      return describePreparationCopy(payload);
    case 'HOMEWORK_CREATED':
      return 'Выдано домашнее задание урока';
    case 'HOMEWORK_UPDATED':
      return 'Изменено домашнее задание урока';
    case 'HOMEWORK_DELETED':
      return 'Снято домашнее задание урока';
    case 'HOMEWORK_ASSIGNMENT_DRAFTED':
      return withTitle('Создан черновик ДЗ', payload);
    case 'HOMEWORK_ASSIGNMENT_UPDATED':
      return withTitle('ДЗ изменено', payload);
    case 'HOMEWORK_ASSIGNMENT_PUBLISHED':
      return withTitle('ДЗ опубликовано', payload);
    case 'HOMEWORK_MARKED_NOT_ASSIGNED':
      return 'Отмечено «ДЗ не задано»';
    case 'HOMEWORK_NOT_ASSIGNED_CLEARED':
      // Публикация снимает отметку сама — строка обязана сказать, что учитель её не
      // отменял, иначе рядом окажутся два события без видимой связи.
      return payload.reason === 'HOMEWORK_PUBLISHED'
        ? 'Отметка «ДЗ не задано» снята: по уроку опубликовано задание'
        : 'Отметка «ДЗ не задано» снята';
    case 'TEXTBOOK_SELECTED': {
      const pages = pagesLabel(payload.pageFrom, payload.pageTo);
      return withTitle('Выбран учебник', payload) + (pages ? `, ${pages}` : '');
    }
    case 'TEXTBOOK_CLEARED':
      return withTitle('Снят выбор учебника', payload);
    case 'MATERIAL_ADDED':
      return withTitle('К уроку добавлен материал', { title: payload.fileName });
    case 'MATERIAL_UPDATED':
      return withTitle(payload.visibleToStudents === true ? 'Материал доступен ученикам'
        : payload.visibleToStudents === false ? 'Материал скрыт от учеников' : 'Материал урока изменён', { title: payload.fileName });
    case 'MATERIAL_REMOVED':
      return withTitle('Материал убран из урока', { title: payload.fileName });
    default:
      return 'Изменение урока';
  }
}

/** «Подготовка перенесена с урока 7А, 12 октября». */
function describePreparationCopy(payload: HistoryPayload): string {
  const date = payload.sourceLessonDate && /^\d{4}-\d{2}-\d{2}$/.test(payload.sourceLessonDate)
    && Number.isFinite(Date.parse(`${payload.sourceLessonDate}T12:00:00`))
    ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
      .format(new Date(`${payload.sourceLessonDate}T12:00:00`))
    : null;
  const from = [payload.sourceClassName, date].filter(Boolean).join(', ');
  return from ? `Подготовка перенесена с урока ${from}` : 'Подготовка перенесена с другого урока';
}

/** «Администратор (Омаров Е.Л.)» или «Система» — Figma 2067:10310, 2067:10334. */
export function describeHistoryActor(entry: LessonHistoryEntry): string {
  if (entry.actorType === 'SYSTEM' || !entry.actorType) return 'Система';
  const role = Object.prototype.hasOwnProperty.call(ACTOR_ROLES, entry.actorType) ? ACTOR_ROLES[entry.actorType] : 'Пользователь';
  return entry.actorName ? `${role} (${entry.actorName})` : role;
}
