import { describe, expect, it } from 'vitest';
import {
  questionFromOtherTest,
  questionFromVariant,
  questionToRequest,
  validateQuestions,
  type QuestionDraft,
} from './testQuestions';
import type { QuestionRequest, QuestionResponse } from './types';

const source: QuestionResponse = {
  id: 42,
  topic: 'Алгебра',
  difficulty: 'MEDIUM',
  type: 'SINGLE_CHOICE',
  text: 'Вычислите 16³ · (2²)⁻³ : 32',
  maxScore: 2,
  allowPhoto: false,
  referenceAnswer: null,
  gradingCriteria: null,
  orderIndex: 3,
  isDraft: true,
  sourceQuestionId: null,
  imageUrl: null,
  options: [
    { id: 1, text: '1/4', isCorrect: true, orderIndex: 0 },
    { id: 2, text: '4', isCorrect: false, orderIndex: 1 },
  ],
};

describe('questionFromOtherTest', () => {
  it('копирует поля и запоминает вопрос-источник', () => {
    const copy = questionFromOtherTest(source, 'Экзамен 8 класс');

    expect(copy.text).toBe(source.text);
    expect(copy.topic).toBe('Алгебра');
    expect(copy.difficulty).toBe('MEDIUM');
    expect(copy.maxScore).toBe(2);
    expect(copy.options.map((o) => [o.text, o.isCorrect])).toEqual([
      ['1/4', true],
      ['4', false],
    ]);
    expect(copy.sourceQuestionId).toBe(42);
    expect(copy.sourceTestTitle).toBe('Экзамен 8 класс');
  });

  /** Копия — самостоятельный вопрос: черновиковость исходника к ней не относится. */
  it('не наследует статус черновика', () => {
    expect(questionFromOtherTest(source, 'Экзамен').isDraft).toBe(false);
  });

  /** Без этого связь терялась бы на первом сохранении, и вопрос можно было бы добавить дважды. */
  it('отдаёт вопрос-источник обратно на сервер', () => {
    const request = questionToRequest(questionFromOtherTest(source, 'Экзамен'), 0);

    expect(request.sourceQuestionId).toBe(42);
    expect(request.orderIndex).toBe(0);
  });
});

describe('questionFromVariant', () => {
  const variant: QuestionRequest = {
    topic: 'Алгебра',
    difficulty: 'MEDIUM',
    type: 'SINGLE_CHOICE',
    text: 'Вычислите 8³ · (2²)⁻³ : 16',
    maxScore: 2,
    allowPhoto: false,
    referenceAnswer: null,
    gradingCriteria: null,
    options: [
      { text: '1/2', isCorrect: true, orderIndex: 0 },
      { text: '2', isCorrect: false, orderIndex: 1 },
    ],
  };

  it('раскладывает вариант в черновик редактора', () => {
    const draft = questionFromVariant(variant);

    expect(draft.text).toBe('Вычислите 8³ · (2²)⁻³ : 16');
    expect(draft.isAiVariant).toBe(true);
    expect(draft.options.map((o) => o.isCorrect)).toEqual([true, false]);
  });

  /** Вариант — не копия чужого вопроса, иначе он бы засчитался как «уже добавлен». */
  it('не ссылается на вопрос-источник', () => {
    expect(questionFromVariant(variant).sourceQuestionId).toBeNull();
  });
});

describe('validateQuestions', () => {
  function draft(overrides: Partial<QuestionDraft>): QuestionDraft {
    return {
      localId: 'q',
      id: null,
      imageUrl: null,
      isDraft: false,
      topic: '',
      difficulty: '',
      type: 'SINGLE_CHOICE',
      text: 'Как часто вы чувствуете тревогу?',
      maxScore: 1,
      allowPhoto: false,
      referenceAnswer: '',
      gradingCriteria: '',
      options: [
        { localId: 'a', text: 'Редко', isCorrect: false },
        { localId: 'b', text: 'Часто', isCorrect: false },
      ],
      sourceQuestionId: null,
      ...overrides,
    };
  }

  it('у учебного теста без правильного варианта сохранить нельзя', () => {
    expect(validateQuestions([draft({})])).toBe('Вопрос 1: отметьте правильный ответ');
  });

  it('психологический тест не оценивается: ни правильный вариант, ни минимальный балл не нужны', () => {
    expect(validateQuestions([draft({}), draft({ type: 'MULTIPLE_CHOICE' })], 100, { graded: false })).toBeNull();
  });

  it('структурные правила у психологического теста остаются', () => {
    expect(validateQuestions([draft({ options: [{ localId: 'a', text: 'Одно', isCorrect: false }] })], 0, { graded: false }))
      .toBe('Вопрос 1: нужно минимум 2 варианта ответа');
  });
});
