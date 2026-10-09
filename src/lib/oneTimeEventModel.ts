import { ApiError } from './api';
import type { Weekday } from './scheduleSettingsTypes';
import type { OneTimeEvent, OneTimeEventOnSchedule, OneTimeEventRequest } from './oneTimeEventsApi';

/**
 * Правила экрана разовых событий: форма, ошибки, неделя сетки и раскладка перекрытий.
 *
 * Чего здесь нет намеренно — пересечений. Какие уроки событие задевает и целиком ли, приходит
 * от бэкенда (`overlaps`), экран только раскладывает готовые строки по клеткам сетки.
 */

export type OneTimeEventAudience = 'SCHOOL' | 'GRADE' | 'CLASSES';
export type EventCoverage = 'FULL' | 'PARTIAL';

export const AUDIENCE_OPTIONS: { value: OneTimeEventAudience; label: string }[] = [
  { value: 'SCHOOL', label: 'Вся школа' },
  { value: 'GRADE', label: 'Параллель' },
  { value: 'CLASSES', label: 'Классы' },
];

export type OneTimeEventForm = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  audience: OneTimeEventAudience;
  grade: string;
  classIds: string[];
  comment: string;
};

export type OneTimeEventField = 'title' | 'date' | 'startTime' | 'endTime' | 'audience' | 'comment';
export type OneTimeEventErrors = Partial<Record<OneTimeEventField, string>>;

export const TITLE_MAX = 255;
export const COMMENT_MAX = 2000;

export function emptyForm(date: string, classId?: string): OneTimeEventForm {
  return {
    title: '',
    date,
    startTime: '',
    endTime: '',
    audience: classId ? 'CLASSES' : 'SCHOOL',
    grade: '',
    classIds: classId ? [classId] : [],
    comment: '',
  };
}

export function formFromEvent(event: OneTimeEvent): OneTimeEventForm {
  return {
    title: event.title ?? '',
    date: event.date ?? '',
    startTime: hhmm(event.startTime),
    endTime: hhmm(event.endTime),
    audience: (event.audience ?? 'SCHOOL') as OneTimeEventAudience,
    grade: event.grade ?? '',
    classIds: (event.classes ?? []).map((c) => String(c.id)),
    comment: event.comment ?? '',
  };
}

/** Проверка до отправки — то же, что проверит сервер (ТЗ §11), чтобы не гонять заведомо пустую форму. */
export function validateForm(form: OneTimeEventForm): OneTimeEventErrors {
  const errors: OneTimeEventErrors = {};
  if (!form.title.trim()) errors.title = 'Укажите название';
  else if (form.title.trim().length > TITLE_MAX) errors.title = `Не длиннее ${TITLE_MAX} символов`;
  if (!form.date) errors.date = 'Укажите дату';
  if (!form.startTime) errors.startTime = 'Укажите время начала';
  if (!form.endTime) errors.endTime = 'Укажите время окончания';
  if (form.startTime && form.endTime && form.endTime <= form.startTime) {
    errors.endTime = 'Окончание должно быть позже начала';
  }
  if (form.audience === 'GRADE' && !form.grade) errors.audience = 'Выберите параллель';
  if (form.audience === 'CLASSES' && form.classIds.length === 0) {
    errors.audience = 'Выберите хотя бы один класс';
  }
  if (form.comment.length > COMMENT_MAX) errors.comment = `Не длиннее ${COMMENT_MAX} символов`;
  return errors;
}

/** Тело запроса: у каждой аудитории — только её поля, иначе сервер ответит 400. */
export function toRequest(form: OneTimeEventForm): OneTimeEventRequest {
  const comment = form.comment.trim();
  return {
    title: form.title.trim(),
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    audience: form.audience,
    grade: form.audience === 'GRADE' ? form.grade : undefined,
    classIds: form.audience === 'CLASSES' ? form.classIds.map(Number) : undefined,
    comment: comment || undefined,
  };
}

/**
 * Ошибку сервера — к полю, если по ней понятно, к какому. Bean Validation присылает поля в
 * `details`, бизнес-проверки сервиса — готовой русской фразой, её узнаём по смыслу.
 */
export function mapOneTimeEventError(error: unknown): { fields: OneTimeEventErrors; form?: string } {
  if (!(error instanceof ApiError)) return { fields: {}, form: 'Не удалось сохранить событие' };
  const fields: OneTimeEventErrors = {};
  if (Array.isArray(error.details)) {
    for (const item of error.details as { field?: string; message?: string }[]) {
      const field = beanField(item.field);
      if (field && item.message) fields[field] = item.message;
    }
    if (Object.keys(fields).length > 0) return { fields };
  }
  const message = error.message;
  if (/название/i.test(message)) return { fields: { title: message } };
  if (/окончани/i.test(message)) return { fields: { endTime: message } };
  if (/дат/i.test(message) && !/период/i.test(message)) return { fields: { date: message } };
  if (/параллел|класс|аудитори/i.test(message)) return { fields: { audience: message } };
  return { fields: {}, form: message };
}

function beanField(field: string | undefined): OneTimeEventField | null {
  switch (field) {
    case 'title':
    case 'date':
    case 'startTime':
    case 'endTime':
    case 'comment':
      return field;
    case 'timeRangeValid':
      return 'endTime';
    case 'audience':
    case 'grade':
    case 'classIds':
      return 'audience';
    default:
      return null;
  }
}

export function hhmm(time: string | undefined | null): string {
  return time ? time.slice(0, 5) : '';
}

export function timeRange(event: { startTime?: string; endTime?: string }): string {
  return `${hhmm(event.startTime)}–${hhmm(event.endTime)}`;
}

/** «Вся школа», «Параллель 7», «7А, 7Б». */
export function audienceLabel(event: OneTimeEvent): string {
  switch (event.audience) {
    case 'GRADE':
      return `Параллель ${event.grade ?? ''}`.trim();
    case 'CLASSES': {
      const names = (event.classes ?? []).map((c) => c.name).filter(Boolean);
      return names.length > 0 ? names.join(', ') : 'Классы';
    }
    default:
      return 'Вся школа';
  }
}

// --- неделя сетки ---

const WEEKDAYS: Weekday[] = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
];

function parseIso(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function formatIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const parsed = parseIso(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatIso(parsed);
}

/** Понедельник недели, в которую попадает дата. */
export function mondayOf(date: string): string {
  const day = parseIso(date).getUTCDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

/** Дата каждого дня недели, начиная с понедельника. */
export function weekDates(monday: string): Record<Weekday, string> {
  return Object.fromEntries(WEEKDAYS.map((day, i) => [day, addDays(monday, i)])) as Record<Weekday, string>;
}

const DAY_MONTH = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const FULL_DATE = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

/** «12 окт.» — подпись дня в шапке сетки. */
export function shortDate(date: string): string {
  return DAY_MONTH.format(parseIso(date));
}

/** «понедельник, 12 октября 2026 г.» — в карточке события. */
export function longDate(date: string): string {
  return FULL_DATE.format(parseIso(date));
}

/** «6–12 окт.» или «29 сент. – 5 окт.». */
export function weekLabel(monday: string): string {
  const sunday = addDays(monday, 6);
  const start = parseIso(monday);
  const end = parseIso(sunday);
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${start.getUTCDate()}–${shortDate(sunday)}`;
  }
  return `${shortDate(monday)} – ${shortDate(sunday)}`;
}

// --- раскладка по сетке ---

export type LessonOverlap = {
  event: OneTimeEventOnSchedule;
  coverage: EventCoverage;
  overlapStart: string;
  overlapEnd: string;
};

/** События дня — шапка столбца: туда попадает и событие, которое не задело ни одного урока. */
export function eventsOn(events: OneTimeEventOnSchedule[], date: string): OneTimeEventOnSchedule[] {
  return events
    .filter((event) => event.date === date)
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
}

/** Что лежит на уроке-слоте в эту дату — по `lessonId` из ответа сервера. */
export function overlapsOf(
  events: OneTimeEventOnSchedule[],
  lessonId: number,
  date: string,
): LessonOverlap[] {
  const result: LessonOverlap[] = [];
  for (const event of events) {
    if (event.date !== date) continue;
    for (const overlap of event.overlaps ?? []) {
      if (overlap.lessonId === lessonId && overlap.coverage) {
        result.push({
          event,
          coverage: overlap.coverage,
          overlapStart: hhmm(overlap.overlapStart),
          overlapEnd: hhmm(overlap.overlapEnd),
        });
      }
    }
  }
  return result;
}
