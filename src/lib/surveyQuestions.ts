import type { SurveyQuestion, SurveyQuestionRequest, SurveyQuestionType } from '@/lib/surveyApi';

/**
 * Черновик вопроса опроса — независимая модель редактора, отдельная от
 * `testQuestions.ts`. Опрос никогда не оценивается: `isCorrect`, `maxScore`,
 * `referenceAnswer`, `gradingCriteria` здесь не «вырезаны» — им просто неоткуда
 * взяться, у вопроса опроса такого понятия нет вовсе.
 */

export const SURVEY_QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  SINGLE_CHOICE: 'Один вариант',
  MULTIPLE_CHOICE: 'Несколько вариантов',
  OPEN_TEXT: 'Открытый ответ',
};

export const SURVEY_QUESTION_TYPES: SurveyQuestionType[] = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'OPEN_TEXT',
];

export function isSurveyChoiceType(type: SurveyQuestionType): boolean {
  return type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
}

export interface SurveyAnswerOptionDraft {
  /** Ключ строки в редакторе; на сервер не уходит. */
  localId: string;
  /** Id существующего варианта, или `undefined` у ещё не сохранённого. */
  id?: number;
  text: string;
}

export interface SurveyQuestionDraft {
  localId: string;
  id?: number;
  type: SurveyQuestionType;
  text: string;
  options: SurveyAnswerOptionDraft[];
}

export function newLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptySurveyQuestion(type: SurveyQuestionType = 'SINGLE_CHOICE'): SurveyQuestionDraft {
  return {
    localId: newLocalId(),
    type,
    text: '',
    options: isSurveyChoiceType(type)
      ? [
          { localId: newLocalId(), text: '' },
          { localId: newLocalId(), text: '' },
        ]
      : [],
  };
}

/** Смена типа на открытый вопрос стирает варианты — у него их не бывает; смена на
 *  вариант с выбором заводит два пустых, минимум для закрытого вопроса. */
export function withSurveyQuestionType(
  question: SurveyQuestionDraft,
  type: SurveyQuestionType,
): SurveyQuestionDraft {
  if (type === question.type) return question;
  if (!isSurveyChoiceType(type)) return { ...question, type, options: [] };
  if (question.options.length >= 2) return { ...question, type };
  return {
    ...question,
    type,
    options: [
      ...question.options,
      ...Array.from({ length: 2 - question.options.length }, () => ({ localId: newLocalId(), text: '' })),
    ],
  };
}

export function surveyQuestionFromView(q: SurveyQuestion): SurveyQuestionDraft {
  return {
    localId: newLocalId(),
    id: q.id,
    type: q.type ?? 'SINGLE_CHOICE',
    text: q.text ?? '',
    options: (q.options ?? []).map((option) => ({
      localId: newLocalId(),
      id: option.id,
      text: option.text ?? '',
    })),
  };
}

export function surveyQuestionToRequest(q: SurveyQuestionDraft): SurveyQuestionRequest {
  return {
    type: q.type,
    text: q.text.trim(),
    options: isSurveyChoiceType(q.type)
      ? q.options.map((option) => ({ text: option.text.trim() }))
      : undefined,
  };
}

/**
 * Проверка набора вопросов перед сохранением. Возвращает текст первой найденной
 * проблемы или `null` — как `validateQuestions` у вступительных тестов, но без правил
 * баллов и правильных ответов, которых здесь нет.
 */
export function validateSurveyQuestions(questions: SurveyQuestionDraft[]): string | null {
  if (questions.length === 0) return 'Добавьте хотя бы один вопрос';

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const n = i + 1;
    if (!q.text.trim()) return `Вопрос ${n}: укажите текст`;

    if (isSurveyChoiceType(q.type)) {
      if (q.options.length < 2) return `Вопрос ${n}: нужно минимум 2 варианта ответа`;
      if (q.options.some((option) => !option.text.trim())) {
        return `Вопрос ${n}: заполните все варианты ответа`;
      }
    }
  }

  return null;
}
