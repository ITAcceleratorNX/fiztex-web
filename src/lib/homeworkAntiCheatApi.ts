import { request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

/**
 * Античит домашнего задания (ТЗ ANTICHEAT-001 §6).
 *
 * В вебе только чтение: события шлёт приложение ученика, а учитель их читает при проверке
 * работы. Записи здесь нет намеренно — сдавать работу с админки нельзя, и эндпоинт ученика
 * из неё дёргать некому.
 */

export type AntiCheatLog = Schema<'AntiCheatLogView'>;
export type AntiCheatAttempt = Schema<'AntiCheatAttemptView'>;
export type AntiCheatEvent = Schema<'AntiCheatEventView'>;
export type AntiCheatEventType = NonNullable<AntiCheatEvent['type']>;

/**
 * Подписи событий. Тип приходит с сервера кодом, а «нарушение или нет» — отдельным
 * признаком `violation`: правило одно на веб и мобилку, и вычислять его здесь заново
 * значило бы завести второе.
 */
export const ANTI_CHEAT_EVENT_LABELS: Record<AntiCheatEventType, string> = {
  TAB_SWITCH: 'Переключение вкладки',
  WINDOW_BLUR: 'Окно потеряло фокус',
  APP_BACKGROUND: 'Приложение свёрнуто',
  PAGE_CLOSE: 'Выход из задания',
  RE_ENTRY: 'Возврат в задание',
  SCREENSHOT_ATTEMPT: 'Попытка скриншота',
};

export const homeworkAntiCheatApi = {
  log: (homeworkId: number, studentProfileId: number, signal?: AbortSignal) =>
    request<AntiCheatLog>(
      `/homework/${homeworkId}/submissions/${studentProfileId}/anti-cheat-events`,
      { signal },
    ),
};
