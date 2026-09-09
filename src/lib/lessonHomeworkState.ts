import type { Lesson } from '@/lib/lessonsApi';

export type LessonHomeworkState = NonNullable<Lesson['homeworkState']>;

/**
 * Слова состояний блока «Домашнее задание» в карточке урока.
 *
 * Живут здесь, а не в разметке, ровно по той же причине, что и слова листа
 * посещаемости: то же состояние показывает мобильное приложение, а «ДЗ не задано» и
 * «Задание не выдано» на двух экранах одного продукта читаются как два разных факта.
 *
 * Формулировки — из ТЗ §4 дословно. Учителю и ученику они совпадают везде, кроме
 * черновика: у ученика черновика не существует, и бэкенд отдаёт ему на этом месте
 * `NOT_SPECIFIED` — то есть разница уже учтена в самом состоянии, и экран её не
 * повторяет.
 */
export function homeworkStateLabel(state: LessonHomeworkState | undefined): string {
  switch (state) {
    case 'ASSIGNED':
      return 'ДЗ задано';
    case 'NOT_ASSIGNED':
      return 'ДЗ не задано';
    case 'DRAFT':
      return 'Черновик. Не опубликовано';
    case 'NOT_SPECIFIED':
      return 'Домашнее задание пока не указано';
    default:
      // Состояния нет в строке расписания: оно приходит только с карточки урока.
      return '';
  }
}

/**
 * Цвет состояния. Два финальных состояния — спокойные: «не задано» такой же законный
 * итог, как «задано», и красить его тревожно значило бы ругать учителя за принятое
 * решение. Незакрытые действия, наоборот, выделены — ради них ТЗ и написано.
 */
export function homeworkStateTone(state: LessonHomeworkState | undefined): string {
  switch (state) {
    case 'ASSIGNED':
      return 'bg-success-bg text-success-fg';
    case 'NOT_ASSIGNED':
      return 'bg-neutral-bg text-neutral-fg';
    case 'DRAFT':
      return 'bg-attention-bg text-attention-fg';
    default:
      return 'bg-info-bg text-link';
  }
}

/**
 * Нужно ли действие учителя. Не «нет задания», а «сценарий не завершён»: черновик тоже
 * ждёт решения, хотя задание уже заведено.
 */
export function homeworkNeedsTeacherAction(state: LessonHomeworkState | undefined): boolean {
  return state === 'NOT_SPECIFIED' || state === 'DRAFT';
}
