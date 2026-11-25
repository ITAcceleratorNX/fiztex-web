import type { BadgeTone } from '@/components/ui/Badge';
import type { AccessJournalEventType, AccessJournalRow } from '@/lib/accessJournalApi';
import { formatDate } from '@/lib/format';
import { SECTION_LABELS, dotDate, joinRu, scopeLabel, sortedSections } from '@/lib/studyAccessModel';
import type { StudyAccessScope, StudyDataSection } from '@/lib/studyAccessApi';

/**
 * Подписи журнала доступа (AUTH-BE-001 §11).
 *
 * Строка журнала отвечает на один вопрос: что сделали с доступом человека. Поэтому
 * подпись — глагол в прошедшем времени, а не имя константы бэкенда: журнал читает
 * администратор, а не разработчик.
 */
const EVENT_LABELS: Record<AccessJournalEventType, { label: string; tone: BadgeTone }> = {
  REQUEST_DRAFT_SAVED: { label: 'Черновик заявки сохранён', tone: 'gray' },
  REQUEST_SUBMITTED: { label: 'Заявка отправлена', tone: 'blue' },
  REQUEST_RESUBMITTED: { label: 'Заявка отправлена повторно', tone: 'blue' },
  REQUEST_APPROVED_LINKED: { label: 'Заявка одобрена — связана с профилем', tone: 'green' },
  REQUEST_APPROVED_CREATED: { label: 'Заявка одобрена — создан профиль', tone: 'green' },
  REQUEST_REJECTED: { label: 'Заявка отклонена', tone: 'red' },
  PARENT_LINK_ADDED: { label: 'Родитель привязан к ребёнку', tone: 'purple' },
  LOGIN_METHOD_ENABLED: { label: 'Открыт способ входа', tone: 'navy' },
  STUDENT_CODE_ISSUED: { label: 'Выдан персональный код', tone: 'amber' },
  STUDENT_CODE_REISSUED: { label: 'Перевыпущен персональный код', tone: 'amber' },
  STUDENT_PIN_RESET: { label: 'Сброшен PIN', tone: 'amber' },
  ACCESS_RESET: { label: 'Сброшен доступ', tone: 'red' },
  TEMP_PASSWORD_ISSUED: { label: 'Выдан временный пароль', tone: 'amber' },
  PASSWORD_CHANGED: { label: 'Пароль изменён', tone: 'gray' },
  PHONE_CHANGED: { label: 'Телефон изменён', tone: 'gray' },
  CODE_GRANT_ADDED: { label: 'Учителю открыта выдача кода', tone: 'navy' },
  CODE_GRANT_REVOKED: { label: 'У учителя отозвана выдача кода', tone: 'gray' },
  STUDY_ACCESS_GRANTED: { label: 'Учителю открыт просмотр учебных данных', tone: 'navy' },
  STUDY_ACCESS_CHANGED: { label: 'Изменён просмотр учебных данных', tone: 'blue' },
  STUDY_ACCESS_REVOKED: { label: 'Отозван просмотр учебных данных', tone: 'gray' },
  STUDY_ACCESS_EXPIRED: { label: 'Истёк просмотр учебных данных', tone: 'gray' },
};

export const JOURNAL_EVENT_OPTIONS = (Object.keys(EVENT_LABELS) as AccessJournalEventType[])
  .map((type) => ({ type, label: EVENT_LABELS[type].label }));

/** Незнакомый тип печатается как есть: новый тип бэкенда не должен прятать строку. */
export function eventLabel(type: AccessJournalRow['type']): { label: string; tone: BadgeTone } {
  if (!type) return { label: '—', tone: 'gray' };
  return EVENT_LABELS[type] ?? { label: type, tone: 'gray' };
}

export const ROLE_LABELS: Record<NonNullable<AccessJournalRow['subjectRole']>, string> = {
  SUPER_ADMIN: 'Суперадмин',
  ADMIN: 'Администратор',
  TEACHER: 'Учитель',
  STUDENT: 'Ученик',
  PARENT: 'Родитель',
  CLEANING: 'Клининг',
  TECHNICIAN: 'Техслужба',
  SECURITY: 'Охрана',
  PSYCHOLOGIST: 'Психолог',
};

export function subjectRoleLabel(role: AccessJournalRow['subjectRole']): string | null {
  return role ? ROLE_LABELS[role] ?? role : null;
}

/**
 * Подробности строки человеческим языком.
 *
 * Секретов в `details` не бывает по построению — бэкенд отказывается записывать ключ
 * вида `code`, `password`, `pin`, `token`. Поэтому здесь нечего прятать, и незнакомый
 * ключ печатается как есть: журнал полезнее с непереведённой строкой, чем без неё.
 */
export function detailsSummary(details: AccessJournalRow['details']): string[] {
  const entries = Object.entries((details ?? {}) as Record<string, unknown>);
  return entries
    .map(([key, value]) => describe(key, value))
    .filter((text): text is string => text !== null);
}

function describe(key: string, value: unknown): string | null {
  switch (key) {
    case 'role':
      return value === 'PARENT' ? 'родитель' : value === 'STUDENT' ? 'ученик' : String(value);
    case 'className':
      return `класс ${String(value)}`;
    case 'hasPhone':
      return value === true ? 'телефон указан' : 'без телефона';
    case 'passwordProvided':
      return value === true ? 'с паролем из заявки' : null;
    case 'previousRequestId':
      return `прошлая заявка № ${String(value)}`;
    case 'pinSet':
      return value === true ? 'PIN уже создан' : 'PIN не создан';
    case 'method':
      return value === 'PHONE_PASSWORD' ? 'вход по телефону и паролю' : `способ входа: ${String(value)}`;
    case 'expiresAt':
      // Срок разрешения приходит моментом — в журнале от него нужна только дата.
      return typeof value === 'string' ? `действует до ${formatDate(value)}` : null;
    case 'teacherProfileId':
      return `учитель #${String(value)}`;
    case 'studentProfileId':
      return `ученик #${String(value)}`;
    case 'parentProfileId':
      return `родитель #${String(value)}`;
    // Права на учебные данные (STUDY-ACCESS-002): снимки «было / стало» и срок — словами.
    // Служебные ключи (id версии, ревизия, школа, имя — оно уже в строке) не печатаются.
    case 'school':
    case 'teacherName':
    case 'versionId':
    case 'revision':
    case 'status':
    case 'academicYearId':
      return null;
    case 'grantId':
      return `право № ${String(value)}`;
    case 'reissuedFromGrantId':
      return value == null ? null : `выдано снова по праву № ${String(value)}`;
    case 'academicYear':
      return value == null ? null : `учебный год ${String(value)}`;
    case 'validUntil':
      return typeof value === 'string' ? `до ${dotDate(value)}` : 'бессрочно';
    case 'reason':
      return value ? `основание: ${String(value)}` : null;
    case 'cause':
      return value === 'TEACHER_DEACTIVATED' ? 'учитель отключён'
        : value === 'ROLE_CHANGED' ? 'у учителя сменилась роль'
        : null;
    case 'previous':
      return value ? `было: ${grantSnapshot(value)}` : null;
    case 'current':
      return value ? `стало: ${grantSnapshot(value)}` : null;
    case 'raw':
      // Бэкенд кладёт сюда строку, которую не смог разобрать как JSON, — показываем как есть.
      return String(value);
    default:
      return `${key}: ${String(value)}`;
  }
}

/** Снимок версии права из журнала: «Оценки и Посещаемость · 8А, 8Б · до 31.05.2027». */
function grantSnapshot(value: unknown): string {
  const snapshot = (value ?? {}) as {
    sections?: StudyDataSection[];
    scope?: { type?: StudyAccessScope['type']; classes?: Array<{ id?: number; name?: string }>; parallels?: string[] };
    validUntil?: string | null;
  };
  return [
    joinRu(sortedSections(snapshot.sections).map((section) => SECTION_LABELS[section])),
    scopeLabel(snapshot.scope),
    snapshot.validUntil ? `до ${dotDate(snapshot.validUntil)}` : 'бессрочно',
  ].join(' · ');
}

