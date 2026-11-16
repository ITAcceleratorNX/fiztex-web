import { describe, expect, it } from 'vitest';
import {
  activeWorks,
  canCancel,
  canReschedule,
  isLockedByResults,
  kindUnavailableReason,
  maxScoreProblem,
  nextWorkHint,
  reminderLabel,
  workStateLabel,
  workTitle,
} from './assessmentWorkModel';

describe('работы СОР/СОЧ: слова и правила', () => {
  it('называет работы и напоминания', () => {
    expect(workTitle({ kind: 'SOR', number: 2 })).toBe('СОР 2');
    expect(workTitle({ kind: 'SOCH', number: undefined })).toBe('СОЧ');
    expect(reminderLabel(3)).toBe('За 3 дня');
    expect(reminderLabel(0)).toBe('Не напоминать');
    expect(reminderLabel(5)).toBe('За 5 дн.');
  });

  it('статус не зависит от даты: проведена только по действию, баллы — по факту', () => {
    expect(workStateLabel({ status: 'PLANNED', hasResults: false })).toBe('Запланирована');
    expect(workStateLabel({ status: 'CONDUCTED', hasResults: false })).toBe('Проведена');
    expect(workStateLabel({ status: 'CONDUCTED', hasResults: true })).toBe('Баллы выставлены');
    expect(workStateLabel({ status: 'CANCELLED', hasResults: false })).toBe('Отменена');
  });

  it('после первого балла перенос и отмена закрыты', () => {
    expect(isLockedByResults({ hasResults: true })).toBe(true);
    expect(isLockedByResults({ hasResults: false })).toBe(false);
    expect(isLockedByResults({})).toBe(false);
  });

  it('называет причину, почему вид недоступен', () => {
    const full = { sorAllowed: true, sorLimit: 3, sorUsed: 3, sochAllowed: true, sochUsed: 1 };
    expect(kindUnavailableReason('SOR', full)).toMatch(/Лимит СОР исчерпан: в четверти 3, назначено 3/);
    expect(kindUnavailableReason('SOCH', full)).toMatch(/уже назначен СОЧ/);
    expect(kindUnavailableReason('SOR', { ...full, sorUsed: 1 })).toBeNull();
    expect(kindUnavailableReason('SOR', { ...full, sorAllowed: false })).toMatch(/не предусмотрен/);
    expect(kindUnavailableReason('SOR', null)).toBeNull();
  });

  it('подсказывает номер будущей СОР', () => {
    expect(nextWorkHint('SOR', { sorAllowed: true, sorLimit: 3, sorUsed: 1 })).toBe('Будет СОР 2: в четверти 3 СОР, назначено 1');
    expect(nextWorkHint('SOCH', { sochAllowed: true })).toBeNull();
  });

  it('максимум — целое от 1 до 1000', () => {
    expect(maxScoreProblem('20')).toBeNull();
    expect(maxScoreProblem('')).toMatch(/Введите/);
    expect(maxScoreProblem('0')).toMatch(/больше 0/);
    expect(maxScoreProblem('-5')).toMatch(/целое/);
    expect(maxScoreProblem('2.5')).toMatch(/целое/);
    expect(maxScoreProblem('1001')).toMatch(/1000/);
  });

  it('отменённые работы из активных исключаются', () => {
    expect(activeWorks([{ status: 'CANCELLED' }, { status: 'PLANNED' }])).toHaveLength(1);
    expect(activeWorks(undefined)).toEqual([]);
  });
});

describe('что можно сделать с работой', () => {
  it('переносят только запланированную без баллов, проведённую — нет', () => {
    expect(canReschedule({ status: 'PLANNED', hasResults: false })).toBe(true);
    expect(canReschedule({ status: 'CONDUCTED', hasResults: false })).toBe(false);
    expect(canReschedule({ status: 'PLANNED', hasResults: true })).toBe(false);
    expect(canReschedule({ status: 'CANCELLED' })).toBe(false);
  });

  it('отменить можно проведённую без баллов, но не с баллами и не отменённую', () => {
    expect(canCancel({ status: 'PLANNED', hasResults: false })).toBe(true);
    expect(canCancel({ status: 'CONDUCTED', hasResults: false })).toBe(true);
    expect(canCancel({ status: 'CONDUCTED', hasResults: true })).toBe(false);
    expect(canCancel({ status: 'CANCELLED' })).toBe(false);
  });
});
