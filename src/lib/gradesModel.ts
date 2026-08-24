import type { GradeType, GradeWriteState } from '@/lib/gradesApi';

/**
 * Названия типов оценки для интерфейса.
 *
 * <p>Список фиксирован справочником бэкенда (`GradeType`, grades-read-contract §3), а не
 * макетом: в Figma у списка свой набор («Диктант», «Реферат»), которого в API нет, и
 * подписи там же расходятся с ТЗ. Приоритет — за backend-ТЗ (GRADES-FE-001, преамбула).
 *
 * <p>Порядок здесь — порядок ТЗ §5.1, а не алфавит: он идёт от самого частого к редкому,
 * и учитель находит нужное сверху.
 */
export const GRADE_TYPE_LABELS: Record<GradeType, string> = {
  LESSON_WORK: 'Работа на уроке',
  ORAL_ANSWER: 'Устный ответ',
  BOARD_WORK: 'Работа у доски',
  INDEPENDENT_WORK: 'Самостоятельная работа',
  CONTROL_WORK: 'Контрольная работа',
  TEST: 'Тест',
  PRACTICAL_OR_LAB: 'Практическая / лабораторная работа',
  PROJECT_OR_PRESENTATION: 'Проект / презентация',
  HOMEWORK: 'Домашнее задание',
  OTHER: 'Другое',
};

export const GRADE_TYPES = Object.keys(GRADE_TYPE_LABELS) as GradeType[];

/**
 * Почему лист только на чтение — словами, которые объясняют, что делать дальше.
 *
 * <p>Причину считает сервер (`writeState`), а не экран: время урока, флаг разрешения и
 * состав замены живут там. Здесь только перевод на человеческий — по одному сообщению
 * на состояние, потому что действия у них разные: «попросите разрешение», «дождитесь
 * урока», «поздно, обратитесь к основному учителю».
 */
export function writeStateNotice(state: GradeWriteState | undefined): string | null {
  switch (state) {
    case undefined:
    case 'ALLOWED':
      return null;
    case 'NOT_TEACHING':
      return 'Оценки этого урока доступны только для просмотра';
    case 'LESSON_CANCELLED':
      return 'Урок отменён — оценки по нему не выставляются';
    case 'LESSON_SUPERSEDED':
      return 'Урок заменён новой версией расписания — откройте актуальный урок';
    case 'SUBSTITUTION_ENDED':
      return 'Замена на этот урок больше не действует — оценки доступны только для просмотра';
    case 'SUBSTITUTE_NOT_PERMITTED':
      return 'Замещающему не выдано разрешение работать с оценками этого урока';
    case 'SUBSTITUTE_WINDOW_NOT_OPEN':
      return 'Урок ещё не начался — выставлять оценки можно во время урока';
    case 'SUBSTITUTE_WINDOW_CLOSED':
      return 'Урок закончился — с оценками теперь работает основной учитель';
    default:
      return 'Оценки этого урока доступны только для просмотра';
  }
}

/**
 * Числовое значение оценки для показа: `4.33`, а не `4.3300000000000001`.
 *
 * <p>Приходит строкой с двумя знаками и такой же строкой показывается — приведение к
 * `Number` теряет масштаб, который контракт §2 объявляет частью ответа.
 */
export function formatNumericValue(value: number | string | undefined): string {
  if (value === undefined || value === null) return '';
  return String(value);
}
