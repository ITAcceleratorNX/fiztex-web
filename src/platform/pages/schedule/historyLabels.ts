import type { ScheduleSettingsAction } from '@/lib/scheduleSettingsTypes';

const ACTION_LABELS: Record<ScheduleSettingsAction, string> = {
  TEMPLATE_CREATED: 'Шаблон создан',
  TEMPLATE_UPDATED: 'Шаблон обновлён',
  TEMPLATE_HIDDEN: 'Шаблон скрыт',
  TEMPLATE_ACTIVATED: 'Шаблон активирован',
  TEMPLATE_COPIED: 'Шаблон скопирован',
  PERIOD_ADDED: 'Добавлен урок',
  PERIOD_UPDATED: 'Обновлён урок',
  PERIOD_DELETED: 'Удалён урок',
  BINDINGS_ASSIGNED: 'Назначены привязки',
  BINDING_REMOVED: 'Снята привязка',
  WORKING_DAYS_UPDATED: 'Обновлены учебные дни',
  CALENDAR_EVENT_CREATED: 'Создано событие календаря',
  CALENDAR_EVENT_UPDATED: 'Обновлено событие календаря',
  CALENDAR_EVENT_HIDDEN: 'Скрыто событие календаря',
  CALENDAR_EVENT_ACTIVATED: 'Активировано событие календаря',
  CALENDAR_EVENT_DELETED: 'Удалено событие календаря',
};

export function historyActionLabel(action: ScheduleSettingsAction): string {
  return ACTION_LABELS[action] ?? action;
}

/** Turn JSON payload into short human-readable lines. */
export function formatHistoryPayload(payload: string | null): string[] {
  if (!payload) return [];
  try {
    const data = JSON.parse(payload) as Record<string, unknown>;
    const lines: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value == null) continue;
      if (typeof value === 'object') {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      } else {
        lines.push(`${key}: ${String(value)}`);
      }
    }
    return lines;
  } catch {
    return [payload];
  }
}

export function formatHistoryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
