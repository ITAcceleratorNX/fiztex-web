/** Human-readable labels for suspicious-activity / notification event types. */
export const ADMISSION_EVENT_LABEL: Record<string, string> = {
  STARTED: 'Старт теста',
  SUBMITTED: 'Отправлено на проверку',
  TIME_EXPIRED: 'Истекло время',
  FOCUS_LOST: 'Вышел из окна',
  FOCUS_RETURNED: 'Вернулся в окно',
  RESUMED: 'Повторный вход',
  CONNECTION_ISSUE: 'Проблема с сохранением',
  TAB_SWITCH: 'Переключение вкладки',
  WINDOW_BLUR: 'Потеря фокуса окна',
  PAGE_CLOSED: 'Закрыл / обновил страницу',
  PAGE_CLOSE: 'Закрытие страницы',
  RE_ENTRY: 'Повторный вход',
};

export function eventLabel(type: string): string {
  return ADMISSION_EVENT_LABEL[type] ?? type;
}
