import { describe, expect, it } from 'vitest';
import {
  answerLabel,
  assignmentState,
  deadlineToIso,
  groupPsychClassesByGrade,
  isDeadlineInPast,
  progressLabel,
} from './psychTestModel';
import type { PsychTestAssignment, PsychTestResultQuestion } from './psychTestsApi';

const singleChoice: PsychTestResultQuestion = {
  id: 1,
  orderIndex: 0,
  type: 'SINGLE_CHOICE',
  text: 'Как часто вы чувствуете тревогу?',
  options: [
    { id: 11, text: 'Редко' },
    { id: 12, text: 'Иногда' },
    { id: 13, text: 'Часто' },
  ],
};

describe('groupPsychClassesByGrade', () => {
  it('сортирует параллели числом, а классы — по литере', () => {
    const groups = groupPsychClassesByGrade([
      { id: 3, name: '10Б', grade: '10', letter: 'Б', studentsCount: 20 },
      { id: 1, name: '2А', grade: '2', letter: 'А', studentsCount: 25 },
      { id: 2, name: '10А', grade: '10', letter: 'А', studentsCount: 22 },
    ]);
    expect(groups.map((g) => g.grade)).toEqual(['2', '10']);
    expect(groups[1].classes.map((c) => c.name)).toEqual(['10А', '10Б']);
    expect(groups[1].classes[0].studentsCount).toBe(22);
  });
});

describe('assignmentState', () => {
  const base: PsychTestAssignment = { id: 1, status: 'ACTIVE', acceptingAnswers: true };

  it('закрытое вручную — «Приём закрыт», даже если срок ещё не прошёл', () => {
    expect(assignmentState({ ...base, status: 'CLOSED', acceptingAnswers: false }).label).toBe('Приём закрыт');
  });

  it('активное с идущим приёмом — «Идёт приём»', () => {
    expect(assignmentState(base).label).toBe('Идёт приём');
  });

  it('активное без приёма — значит, прошёл срок', () => {
    expect(assignmentState({ ...base, acceptingAnswers: false }).label).toBe('Срок истёк');
  });
});

describe('answerLabel', () => {
  it('одиночный выбор — текст варианта', () => {
    expect(answerLabel(singleChoice, { questionId: 1, selectedOptionIds: [12] })).toBe('Иногда');
  });

  it('множественный выбор — в порядке вопроса, а не нажатий; удалённый вариант пропускается', () => {
    const multiple = { ...singleChoice, type: 'MULTIPLE_CHOICE' as const };
    expect(answerLabel(multiple, { questionId: 1, selectedOptionIds: [13, 99, 11] })).toBe('Редко; Часто');
  });

  it('открытый вопрос — обрезанный текст; пустой ответ — null', () => {
    const open: PsychTestResultQuestion = { id: 2, orderIndex: 1, type: 'OPEN_TEXT', text: 'Что беспокоит?', options: [] };
    expect(answerLabel(open, { questionId: 2, openText: '  Экзамены ' })).toBe('Экзамены');
    expect(answerLabel(open, { questionId: 2, openText: '   ' })).toBeNull();
    expect(answerLabel(open, undefined)).toBeNull();
  });
});

describe('срок', () => {
  it('пустое поле — без срока', () => {
    expect(deadlineToIso('')).toBeUndefined();
  });

  it('местное время уходит моментом', () => {
    const iso = deadlineToIso('2030-05-20T18:30');
    expect(iso).toBe(new Date('2030-05-20T18:30').toISOString());
  });

  it('прошедшее время распознаётся', () => {
    const now = new Date('2030-05-20T18:31');
    expect(isDeadlineInPast('2030-05-20T18:30', now)).toBe(true);
    expect(isDeadlineInPast('2030-05-21T09:00', now)).toBe(false);
  });
});

describe('progressLabel', () => {
  it('считает по готовым счётчикам сервера', () => {
    expect(progressLabel({ id: 1, completedCount: 5, recipientsTotal: 25 })).toBe('Пройдено: 5 из 25');
  });
});
