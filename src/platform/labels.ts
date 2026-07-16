import type {
  AcademicPeriodStatus,
  AcademicPeriodType,
  AcademicYearStatus,
  AccountRole,
  AccountStatus,
  CredentialStatus,
  ImportEntityType,
  SchoolRecordStatus,
} from './types';
import type {
  CalendarEventEffect,
  CalendarEventStatus,
  CalendarEventType,
  Weekday,
} from '@/lib/scheduleSettingsTypes';

export const ROLE_LABELS: Record<AccountRole, string> = {
  SUPER_ADMIN: 'Супер-админ',
  ADMIN: 'Админ',
  TEACHER: 'Учитель',
  STUDENT: 'Ученик',
  PARENT: 'Родитель',
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  NOT_ACTIVATED: 'Не активирован',
  ACTIVE: 'Активен',
  BLOCKED: 'Заблокирован',
  ARCHIVED: 'Архив',
};

export const SCHOOL_STATUS_LABELS: Record<SchoolRecordStatus, string> = {
  ACTIVE: 'Активен',
  ARCHIVED: 'Архив',
};

export const YEAR_STATUS_LABELS: Record<AcademicYearStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активен',
  ARCHIVED: 'Архив',
};

export const PERIOD_STATUS_LABELS: Record<AcademicPeriodStatus, string> = {
  ACTIVE: 'Активен',
  DISABLED: 'Отключён',
  ARCHIVED: 'Архив',
};

export const PERIOD_TYPE_LABELS: Record<AcademicPeriodType, string> = {
  QUARTER: 'Четверть',
  TRIMESTER: 'Триместр',
  SEMESTER: 'Семестр',
  CUSTOM: 'Свой период',
};

export const CREDENTIAL_STATUS_LABELS: Record<CredentialStatus, string> = {
  ACTIVE: 'Код активен',
  USED: 'Использован',
  REPLACED: 'Перевыпущен',
  BLOCKED: 'Заблокирован',
  EXPIRED: 'Истёк',
};

export const IMPORT_TYPE_LABELS: Record<ImportEntityType, string> = {
  STUDENTS: 'Ученики',
  PARENTS: 'Родители',
  TEACHERS: 'Учителя',
  CLASSES: 'Классы',
};

export const WEEKDAYS_ORDER: Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  MONDAY: 'Пн',
  TUESDAY: 'Вт',
  WEDNESDAY: 'Ср',
  THURSDAY: 'Чт',
  FRIDAY: 'Пт',
  SATURDAY: 'Сб',
  SUNDAY: 'Вс',
};

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: 'Понедельник',
  TUESDAY: 'Вторник',
  WEDNESDAY: 'Среда',
  THURSDAY: 'Четверг',
  FRIDAY: 'Пятница',
  SATURDAY: 'Суббота',
  SUNDAY: 'Воскресенье',
};

export const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  HOLIDAY: 'Праздник',
  VACATION: 'Каникулы',
  NON_SCHOOL_DAY: 'Неучебный день',
  EXAM_DAY: 'Экзамен / аттестация',
  OTHER: 'Другое',
};

export const CALENDAR_EVENT_EFFECT_LABELS: Record<CalendarEventEffect, string> = {
  NO_LESSONS: 'Занятий нет',
  INFO: 'Информационное',
};

export const CALENDAR_EVENT_STATUS_LABELS: Record<CalendarEventStatus, string> = {
  ACTIVE: 'Активно',
  HIDDEN: 'Скрыто',
};

export const CALENDAR_EVENT_TYPE_DOT: Record<CalendarEventType, string> = {
  HOLIDAY: 'bg-rose-500',
  VACATION: 'bg-sky-500',
  NON_SCHOOL_DAY: 'bg-amber-500',
  EXAM_DAY: 'bg-violet-500',
  OTHER: 'bg-slate-400',
};

/** Route path → page title for AppHeader on /admin/* routes. */
export const ADMIN_PAGE_TITLES: Record<string, string> = {
  '/admin': 'Главная',
  '/admin/users': 'Пользователи',
  '/admin/classes': 'Классы',
  '/admin/academic-year': 'Учебный год',
  '/admin/periods': 'Учебные периоды',
  '/admin/schedule-settings': 'Настройки расписания',
  '/admin/access-codes': 'Доступы / коды',
  '/admin/import': 'Импорт данных',
};
