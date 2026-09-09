import { describe, expect, it } from 'vitest';
import {
  homeworkNeedsTeacherAction,
  homeworkStateLabel,
  homeworkStateTone,
} from './lessonHomeworkState';

/**
 * Слова состояний ДЗ проверяются отдельно от экрана: их же показывает мобильное
 * приложение, и расхождение формулировок было бы расхождением продукта, а не вёрстки.
 */
describe('состояния домашнего задания урока', () => {
  it('называет каждое состояние словами ТЗ', () => {
    expect(homeworkStateLabel('ASSIGNED')).toBe('ДЗ задано');
    expect(homeworkStateLabel('NOT_ASSIGNED')).toBe('ДЗ не задано');
    expect(homeworkStateLabel('DRAFT')).toBe('Черновик. Не опубликовано');
    expect(homeworkStateLabel('NOT_SPECIFIED')).toBe('Домашнее задание пока не указано');
  });

  it('молчит там, где состояния не пришло — в строке расписания', () => {
    expect(homeworkStateLabel(undefined)).toBe('');
    expect(homeworkStateTone(undefined)).toBeTruthy();
  });

  it('ждёт действия учителя, пока сценарий не закрыт', () => {
    expect(homeworkNeedsTeacherAction('NOT_SPECIFIED')).toBe(true);
    // Черновик — тоже незакрытое действие: задание есть, а ученик его не видит.
    expect(homeworkNeedsTeacherAction('DRAFT')).toBe(true);
  });

  it('не торопит учителя на двух финальных состояниях', () => {
    expect(homeworkNeedsTeacherAction('ASSIGNED')).toBe(false);
    // «Не задано» — такое же решение, как «задано», и напоминать по нему не о чем.
    expect(homeworkNeedsTeacherAction('NOT_ASSIGNED')).toBe(false);
  });
});
