import type { QuestionType } from '@/lib/types';

export const TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Один вариант',
  MULTIPLE_CHOICE: 'Несколько вариантов',
  OPEN_TEXT: 'Открытый ответ',
  PHOTO: 'Фото',
};

export const EVENT_LABEL: Record<string, string> = {
  STARTED: 'Старт теста',
  FOCUS_LOST: 'Ушёл со вкладки / потерял фокус',
  FOCUS_RETURNED: 'Вернулся в окно',
  PAGE_CLOSED: 'Закрыл / обновил страницу',
  RESUMED: 'Повторный вход',
  TIME_EXPIRED: 'Истекло время',
  SUBMITTED: 'Отправлено на проверку',
  TAB_SWITCH: 'Переключение вкладки',
  WINDOW_BLUR: 'Потеря фокуса окна',
  PAGE_CLOSE: 'Закрытие страницы',
  RE_ENTRY: 'Повторный вход',
};

export interface ScoreDraft {
  score: string;
  comment: string;
}
