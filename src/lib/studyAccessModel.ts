import { ApiError } from './api';
import { personShortName, pluralRu } from './format';
import type {
  CreateStudyAccessGrant,
  StudyAccessGrant,
  StudyAccessOptions,
  StudyAccessOptionsYear,
  StudyAccessScope,
  StudyDataScopeType,
  StudyDataSection,
} from './studyAccessApi';

/**
 * Слова и правила формы дополнительных прав (STUDY-ACCESS-002, Figma `phyztex` А1–А15).
 *
 * Права, сроки и «что останется после отзыва» считает сервер — здесь только подписи и форма.
 * Проверка формы повторяет правила сервера ровно теми же словами: она отвечает сразу, без
 * запроса, а окончательный ответ всё равно даёт сервер (`serverGrantErrors`).
 */

export const SECTION_ORDER: readonly StudyDataSection[] = ['GRADES', 'ATTENDANCE', 'ANALYTICS'];

export const SECTION_LABELS: Record<StudyDataSection, string> = {
  GRADES: 'Оценки',
  ATTENDANCE: 'Посещаемость',
  ANALYTICS: 'Учебная аналитика',
};

export const SECTION_OPTIONS = SECTION_ORDER.map((value) => ({
  value,
  title: SECTION_LABELS[value],
  description: {
    GRADES: 'Журнал, СОР/СОЧ и итоговые оценки',
    ATTENDANCE: 'Отметки и пропуски по урокам',
    ANALYTICS: 'Успеваемость и динамика по классам',
  }[value],
}));

/** Разделы в винительном падеже — «перестанет видеть оценки и учебную аналитику». */
const SECTION_OBJECT: Record<StudyDataSection, string> = {
  GRADES: 'оценки',
  ATTENDANCE: 'посещаемость',
  ANALYTICS: 'учебную аналитику',
};

export const SCOPE_OPTIONS: ReadonlyArray<{ value: StudyDataScopeType; label: string }> = [
  { value: 'CLASSES', label: 'Классы' },
  { value: 'PARALLELS', label: 'Параллели' },
  { value: 'SCHOOL', label: 'Вся школа' },
];

export const TERM_OPTIONS: ReadonlyArray<{ value: TermMode; label: string }> = [
  { value: 'UNTIL', label: 'До даты' },
  { value: 'OPEN', label: 'Бессрочно' },
];

export const STATE_LABELS: Record<NonNullable<StudyAccessGrant['state']>, string> = {
  ACTIVE: 'Активен',
  EXPIRED: 'Истёк',
  REVOKED: 'Отозван',
};

export function sortedSections(sections: ReadonlyArray<StudyDataSection> | undefined): StudyDataSection[] {
  const set = new Set(sections ?? []);
  return SECTION_ORDER.filter((section) => set.has(section));
}

/** «а», «а и б», «а, б и в». */
export function joinRu(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} и ${items[items.length - 1]}`;
}

/** Колонка «Классы»: «8А, 8Б», «Параллели 9, 10, 11», «Вся школа». */
export function scopeLabel(scope: StudyAccessScope | undefined): string {
  if (!scope) return '—';
  if (scope.type === 'SCHOOL') return 'Вся школа';
  if (scope.type === 'PARALLELS') {
    const grades = sortedGrades(scope.parallels);
    return `${grades.length === 1 ? 'Параллель' : 'Параллели'} ${grades.join(', ')}`;
  }
  return (scope.classes ?? []).map((item) => item.name).join(', ') || '—';
}

/** «до 31.05.2027» или «Бессрочно». */
export function validityLabel(validUntil: string | null | undefined): string {
  return validUntil ? `до ${dotDate(validUntil)}` : 'Бессрочно';
}

/**
 * Остаток срока у действующего права: «ещё 38 дн.», «ещё 6 мес.» (А6–А7). Сокращения
 * намеренные — с ними не нужно склонять число, а колонка узкая. Последний день назван
 * словами: «ещё 0 дн.» читалось бы как «уже нет».
 */
export function remainingLabel(daysLeft: number | null | undefined): string | null {
  if (daysLeft == null || daysLeft < 0) return null;
  if (daysLeft === 0) return 'последний день';
  if (daysLeft < 60) return `ещё ${daysLeft} дн.`;
  return `ещё ${Math.floor(daysLeft / 30)} мес.`;
}

/** «31.05.2027» из «2027-05-31». */
export function dotDate(iso: string | null | undefined): string {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '—';
}

/** Сегодняшняя дата школы строкой «YYYY-MM-DD» — по часам браузера, в его часовом поясе. */
export function localIsoDate(date: Date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** «Сапарова А.К.» из «Сапарова Айгерим Кайратовна». */
export function teacherShortName(fullName: string | undefined): string {
  const [lastName = '', firstName = '', ...rest] = (fullName ?? '').trim().split(/\s+/);
  if (!firstName) return lastName;
  return personShortName({ lastName, firstName, middleName: rest.join(' ') || null });
}

/**
 * Текст подтверждения отзыва (А11): что именно перестанет видеть учитель — разделы и область
 * этой записи, год — если не текущий. Если те же данные открыты другим действующим правом
 * (`retainedElsewhere` считает сервер), полной потери доступа не обещаем.
 */
export function revokeMessage(grant: StudyAccessGrant, teacherFullName: string | undefined): {
  lead: string;
  subject: string;
  tail: string;
} {
  const who = teacherShortName(teacherFullName) || 'Учитель';
  const subject = [
    joinRu(sortedSections(grant.sections).map((section) => SECTION_OBJECT[section])),
    scopeObject(grant.scope),
    grant.academicYear && !grant.academicYear.current ? `за ${grant.academicYear.name}` : null,
  ].filter(Boolean).join(' ');
  const keeps = ' Свои уроки, классы и роль учителя останутся без изменений. Запись об отзыве сохранится в карточке.';
  if (grant.retainedElsewhere === 'FULL') {
    return {
      lead: `Эта запись будет отозвана, но ${who} продолжит видеть `,
      subject,
      tail: ` по другим действующим правам.${keeps}`,
    };
  }
  return {
    lead: `${who} перестанет видеть `,
    subject,
    tail: grant.retainedElsewhere === 'PARTIAL'
      ? `, кроме того, что открыто другими действующими правами.${keeps}`
      : `.${keeps}`,
  };
}

/** Область в родительном падеже после раздела: «8А, 8Б», «параллелей 9, 10», «всей школы». */
function scopeObject(scope: StudyAccessScope | undefined): string {
  if (!scope) return '';
  if (scope.type === 'SCHOOL') return 'всей школы';
  if (scope.type === 'PARALLELS') {
    const grades = sortedGrades(scope.parallels);
    return `${grades.length === 1 ? 'параллели' : 'параллелей'} ${grades.join(', ')}`;
  }
  return (scope.classes ?? []).map((item) => item.name).join(', ');
}

function sortedGrades(parallels: readonly string[] | undefined): string[] {
  return [...(parallels ?? [])].sort((a, b) => (Number(a) - Number(b)) || a.localeCompare(b, 'ru'));
}

// ── Форма ────────────────────────────────────────────────────────────────────

export type TermMode = 'UNTIL' | 'OPEN';

export interface GrantForm {
  sections: StudyDataSection[];
  academicYearId: number | null;
  scopeType: StudyDataScopeType;
  classIds: number[];
  parallels: string[];
  term: TermMode;
  /** «YYYY-MM-DD»; пустая строка — дата не выбрана. */
  validUntil: string;
}

export type GrantFormField = 'sections' | 'academicYearId' | 'scope' | 'validUntil';
export type GrantFormErrors = Partial<Record<GrantFormField | 'form', string>>;

export const FORM_ERROR = 'Проверьте отмеченные поля — без них доступ не сохранить';

export function emptyGrantForm(defaultYearId: number | null | undefined): GrantForm {
  return {
    sections: [],
    academicYearId: defaultYearId ?? null,
    scopeType: 'CLASSES',
    classIds: [],
    parallels: [],
    term: 'UNTIL',
    validUntil: '',
  };
}

/** Поля выбранного права — для «Изменить». */
export function grantForm(grant: StudyAccessGrant): GrantForm {
  const scopeType = grant.scope?.type ?? 'CLASSES';
  return {
    sections: sortedSections(grant.sections),
    academicYearId: grant.academicYear?.id ?? null,
    scopeType,
    classIds: scopeType === 'CLASSES' ? (grant.scope?.classes ?? []).flatMap((item) => (item.id == null ? [] : [item.id])) : [],
    parallels: scopeType === 'PARALLELS' ? sortedGrades(grant.scope?.parallels) : [],
    term: grant.validUntil ? 'UNTIL' : 'OPEN',
    validUntil: grant.validUntil ?? '',
  };
}

/**
 * Прежние параметры для «Выдать снова» (ТЗ §4): новая форма, ничего не восстанавливается само.
 * Прошедший срок не переносится — его всё равно пришлось бы менять, а подставленная
 * прошедшая дата сразу встретила бы администратора ошибкой.
 */
export function reissueForm(grant: StudyAccessGrant, options: StudyAccessOptions | undefined, today: string): GrantForm {
  const form = grantForm(grant);
  const yearKnown = (options?.years ?? []).some((year) => year.id === form.academicYearId);
  const next = yearKnown ? form : withYear(form, options?.defaultYearId ?? null);
  return next.validUntil && next.validUntil <= today ? { ...next, validUntil: '' } : next;
}

/** Смена года: классы и параллели другого года несовместимы (ТЗ §4) — выбор сбрасывается. */
export function withYear(form: GrantForm, academicYearId: number | null): GrantForm {
  if (academicYearId === form.academicYearId) return form;
  return { ...form, academicYearId, classIds: [], parallels: [] };
}

/** Смена режима области очищает значения прежнего режима: смешанной области не бывает. */
export function withScopeType(form: GrantForm, scopeType: StudyDataScopeType): GrantForm {
  if (scopeType === form.scopeType) return form;
  return { ...form, scopeType, classIds: [], parallels: [] };
}

export function yearOf(options: StudyAccessOptions | undefined, yearId: number | null): StudyAccessOptionsYear | undefined {
  return (options?.years ?? []).find((year) => year.id === yearId);
}

/** «2026/2027 — текущий» — подпись года в выборе. */
export function yearOptionLabel(year: { name?: string; current?: boolean }): string {
  return year.current ? `${year.name} — текущий` : year.name ?? '';
}

/**
 * Предупреждение режима «Вся школа» (А5): масштаб в цифрах сервера и то, что область живая —
 * новые классы этого года войдут сами, а в следующий год доступ не переносится.
 */
export function schoolScopeNotice(year: StudyAccessOptionsYear | undefined): string {
  const classes = year?.classCount ?? 0;
  const students = year?.studentCount ?? 0;
  return `Все классы школы за выбранный год — ${classes} ${pluralRu(classes, ['класс', 'класса', 'классов'])}, `
    + `${students} ${pluralRu(students, ['ученик', 'ученика', 'учеников'])}. `
    + 'Новые классы этого года попадут в доступ автоматически.';
}

export function grantRequest(form: GrantForm): CreateStudyAccessGrant {
  return {
    sections: sortedSections(form.sections),
    academicYearId: form.academicYearId ?? 0,
    scope: {
      type: form.scopeType,
      classIds: form.scopeType === 'CLASSES' ? form.classIds : [],
      parallels: form.scopeType === 'PARALLELS' ? form.parallels : [],
    },
    validUntil: form.term === 'UNTIL' && form.validUntil ? form.validUntil : null,
  };
}

/**
 * Проверка формы до отправки — те же правила и те же слова, что у сервера (А14). Срок,
 * оставленный при изменении без правки (`keptValidUntil`), не перепроверяется: право
 * «до 01.12» можно поправить первого декабря, не трогая дату.
 */
export function validateGrantForm(form: GrantForm, today: string, keptValidUntil?: string | null): GrantFormErrors {
  const errors: GrantFormErrors = {};
  if (form.sections.length === 0) errors.sections = 'Выберите хотя бы один раздел';
  if (form.academicYearId == null) errors.academicYearId = 'Выберите учебный год';
  if (form.scopeType === 'CLASSES' && form.classIds.length === 0) errors.scope = 'Выберите хотя бы один класс';
  if (form.scopeType === 'PARALLELS' && form.parallels.length === 0) errors.scope = 'Выберите хотя бы одну параллель';
  if (form.term === 'UNTIL') {
    const kept = Boolean(keptValidUntil) && form.validUntil === keptValidUntil;
    if (!form.validUntil) errors.validUntil = 'Выберите дату позже сегодняшней';
    else if (!kept && form.validUntil < today) errors.validUntil = 'Дата уже прошла — выберите дату позже сегодняшней';
    else if (!kept && form.validUntil === today) errors.validUntil = 'Выберите дату позже сегодняшней';
  }
  if (Object.keys(errors).length > 0) errors.form = FORM_ERROR;
  return errors;
}

/**
 * Отказ сервера по полям (400 `STUDY_ACCESS_INVALID`, все нарушения в `details`) — на поля
 * формы. Поле, которого в форме нет (ревизия, основание), уходит в общую плашку.
 */
export function serverGrantErrors(error: unknown): GrantFormErrors | null {
  if (!(error instanceof ApiError) || error.code !== 'STUDY_ACCESS_INVALID') return null;
  const errors: GrantFormErrors = { form: error.message || FORM_ERROR };
  const details = Array.isArray(error.details) ? (error.details as Array<{ field?: string; message?: string }>) : [];
  for (const { field, message } of details) {
    const key = formField(field);
    if (key && message && !errors[key]) errors[key] = message;
    else if (!key && message) errors.form = message;
  }
  return errors;
}

function formField(field: string | undefined): GrantFormField | null {
  if (field === 'sections' || field === 'academicYearId' || field === 'validUntil') return field;
  if (field?.startsWith('scope')) return 'scope';
  return null;
}

/** Сбой связи — форма остаётся, кнопка становится «Повторить» (А15). */
export function isConnectionFailure(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}
