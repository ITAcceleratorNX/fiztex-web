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

/** Route path → page title for AdminHeader */
export const ADMIN_PAGE_TITLES: Record<string, string> = {
  '/admin': 'Главная',
  '/admin/users': 'Пользователи',
  '/admin/classes': 'Классы',
  '/admin/academic-year': 'Учебный год',
  '/admin/periods': 'Учебные периоды',
  '/admin/access-codes': 'Доступы / коды',
  '/admin/import': 'Импорт данных',
};
