import { ApiError } from '@/lib/api';

/** Keep API codes and raw server details out of school-administration messages. */
export function platformErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'ANOTHER_YEAR_ACTIVE') {
      return 'Сначала завершите текущий учебный год, затем активируйте другой.';
    }
    if (error.status === 0) {
      return 'Нет связи с сервером. Проверьте подключение и попробуйте снова.';
    }
    return fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
