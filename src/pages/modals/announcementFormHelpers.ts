import type { AnnouncementRequest } from '@/lib/announcementsApi';

/**
 * `<input type="datetime-local">` работает со строкой `YYYY-MM-DDTHH:mm`, а бэкенд
 * отдаёт локальное школьное время с секундами (`2026-09-12T10:00:00`).
 *
 * <p>Ни в ту, ни в другую сторону здесь нет `new Date()` — и это главное. Значение
 * уже локальное школьное; прогнав его через `Date`, мы бы перевели его в зону
 * браузера и сдвинули время у любого, кто открыл админку из другого часового пояса.
 * Поэтому — только обрезка и дополнение строки.
 */
export function toDateTimeLocal(value: string | undefined | null): string {
  if (!value) return '';
  return value.slice(0, 16);
}

/** Пустое поле — «дата не назначена», а не «начало эпохи». */
export function fromDateTimeLocal(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export interface AnnouncementFormState {
  title: string;
  grade: string;
  summary: string;
  eventAt: string;
  location: string;
  preparation: string;
  formatInfo: string;
  bringWithYou: string;
  recommendations: string;
}

export const EMPTY_ANNOUNCEMENT_FORM: AnnouncementFormState = {
  title: '',
  grade: '',
  summary: '',
  eventAt: '',
  location: '',
  preparation: '',
  formatInfo: '',
  bringWithYou: '',
  recommendations: '',
};

/**
 * Собирает тело запроса из формы.
 *
 * <p>Пустые строки отправляются как есть: приведение «пустое → не заполнено»
 * живёт на бэкенде, в одном месте для всех клиентов. Дублировать его здесь
 * значило бы завести второй источник правды о том, что считать заполненным.
 */
export function toAnnouncementRequest(form: AnnouncementFormState): AnnouncementRequest {
  return {
    title: form.title.trim(),
    grade: form.grade.trim(),
    summary: form.summary,
    eventAt: fromDateTimeLocal(form.eventAt),
    location: form.location,
    preparation: form.preparation,
    formatInfo: form.formatInfo,
    bringWithYou: form.bringWithYou,
    recommendations: form.recommendations,
  };
}

/** Валидация формы: обязательны те же поля, что и на бэкенде (§3.2). */
export function validateAnnouncementForm(form: AnnouncementFormState): string | null {
  if (!form.title.trim()) return 'Укажите название анонса';
  if (!form.grade.trim()) return 'Выберите класс';
  return null;
}
