/**
 * Цвета бейджей школьного календаря (Figma 2015:9793 и соседние строки).
 *
 * Макет задаёт пары для четырёх типов из пяти; NON_SCHOOL_DAY в таблице не
 * нарисован — взят красный, потому что это буквально «занятий нет», а колонка
 * статуса стоит отдельно и путаницы не создаёт.
 */

import type { CalendarEventEffect, CalendarEventType } from '@/lib/scheduleSettingsTypes';

export const EVENT_TYPE_BADGE: Record<CalendarEventType, string> = {
  VACATION: 'bg-vacation-bg text-vacation-fg',
  HOLIDAY: 'bg-holiday-bg text-holiday-fg',
  EXAM_DAY: 'bg-attention-bg text-attention-fg',
  NON_SCHOOL_DAY: 'bg-no-lessons-bg text-no-lessons-fg',
  OTHER: 'bg-neutral-bg text-neutral-fg',
};

export const EVENT_EFFECT_BADGE: Record<CalendarEventEffect, string> = {
  NO_LESSONS: 'bg-no-lessons-bg text-no-lessons-fg',
  INFO: 'bg-info-badge text-info-fg',
};

/** Порядок пилюль фильтра — как в макете (2015:9765…9776). */
export const EVENT_TYPE_ORDER: CalendarEventType[] = [
  'VACATION',
  'HOLIDAY',
  'NON_SCHOOL_DAY',
  'EXAM_DAY',
  'OTHER',
];
