import { describe, expect, it } from 'vitest';
import {
  emptySurveyQuestion,
  surveyQuestionFromView,
  surveyQuestionToRequest,
  validateSurveyQuestions,
  withSurveyQuestionType,
  type SurveyQuestionDraft,
} from './surveyQuestions';
import type { SurveyQuestion } from './surveyApi';

function draft(overrides: Partial<SurveyQuestionDraft> = {}): SurveyQuestionDraft {
  return { ...emptySurveyQuestion('OPEN_TEXT'), ...overrides };
}

describe('validateSurveyQuestions', () => {
  it('требует хотя бы один вопрос', () => {
    expect(validateSurveyQuestions([])).toBe('Добавьте хотя бы один вопрос');
  });

  it('требует текст вопроса', () => {
    const result = validateSurveyQuestions([draft({ text: '  ' })]);
    expect(result).toMatch(/укажите текст/);
  });

  it('требует минимум два варианта у вопроса с выбором', () => {
    const question = emptySurveyQuestion('SINGLE_CHOICE');
    question.text = 'Вопрос';
    question.options = [{ localId: 'a', text: 'Один вариант' }];

    const result = validateSurveyQuestions([question]);
    expect(result).toMatch(/минимум 2 варианта/);
  });

  it('требует заполненный текст у каждого варианта', () => {
    const question = emptySurveyQuestion('SINGLE_CHOICE');
    question.text = 'Вопрос';
    question.options = [
      { localId: 'a', text: 'Да' },
      { localId: 'b', text: '   ' },
    ];

    const result = validateSurveyQuestions([question]);
    expect(result).toMatch(/заполните все варианты/);
  });

  it('не требует вариантов у открытого вопроса', () => {
    const question = draft({ text: 'Что понравилось?', type: 'OPEN_TEXT', options: [] });
    expect(validateSurveyQuestions([question])).toBeNull();
  });

  it('пропускает корректный набор вопросов', () => {
    const single = emptySurveyQuestion('SINGLE_CHOICE');
    single.text = 'Вопрос с выбором';
    single.options = [
      { localId: 'a', text: 'Да' },
      { localId: 'b', text: 'Нет' },
    ];
    const open = draft({ text: 'Открытый вопрос' });

    expect(validateSurveyQuestions([single, open])).toBeNull();
  });
});

describe('withSurveyQuestionType', () => {
  it('стирает варианты при переключении на открытый вопрос', () => {
    const question = emptySurveyQuestion('SINGLE_CHOICE');
    const next = withSurveyQuestionType(question, 'OPEN_TEXT');
    expect(next.options).toEqual([]);
  });

  it('заводит минимум два варианта при переключении на вопрос с выбором', () => {
    const question = draft({ type: 'OPEN_TEXT', options: [] });
    const next = withSurveyQuestionType(question, 'MULTIPLE_CHOICE');
    expect(next.options).toHaveLength(2);
  });

  it('сохраняет уже введённые варианты, если их уже минимум два', () => {
    const question = emptySurveyQuestion('SINGLE_CHOICE');
    question.options = [
      { localId: 'a', text: 'Раз' },
      { localId: 'b', text: 'Два' },
      { localId: 'c', text: 'Три' },
    ];
    const next = withSurveyQuestionType(question, 'MULTIPLE_CHOICE');
    expect(next.options.map((o) => o.text)).toEqual(['Раз', 'Два', 'Три']);
  });
});

describe('surveyQuestionFromView / surveyQuestionToRequest', () => {
  const view: SurveyQuestion = {
    id: 7,
    orderIndex: 1,
    type: 'SINGLE_CHOICE',
    text: 'Насколько понятен урок?',
    options: [
      { id: 1, text: 'Понятно', orderIndex: 0 },
      { id: 2, text: 'Не очень', orderIndex: 1 },
    ],
  };

  it('раскладывает ответ сервера в черновик', () => {
    const question = surveyQuestionFromView(view);
    expect(question.id).toBe(7);
    expect(question.text).toBe('Насколько понятен урок?');
    expect(question.options.map((o) => o.text)).toEqual(['Понятно', 'Не очень']);
  });

  it('не содержит полей оценивания', () => {
    const question = surveyQuestionFromView(view);
    expect(question).not.toHaveProperty('isCorrect');
    expect(question).not.toHaveProperty('maxScore');
    expect(question).not.toHaveProperty('referenceAnswer');
    expect(question).not.toHaveProperty('gradingCriteria');
  });

  it('собирает запрос без пустых полей текста', () => {
    const question = surveyQuestionFromView(view);
    question.options[0].text = '  Понятно  ';
    const request = surveyQuestionToRequest(question);

    expect(request.type).toBe('SINGLE_CHOICE');
    expect(request.options?.[0]).toEqual({ text: 'Понятно' });
  });

  it('не отправляет варианты у открытого вопроса', () => {
    const open = surveyQuestionFromView({ ...view, type: 'OPEN_TEXT', options: [] });
    const request = surveyQuestionToRequest(open);
    expect(request.options).toBeUndefined();
  });
});
