import type { HomeworkQuestion, SaveQuestionsRequest } from '@/lib/homeworkAiApi';

/**
 * Черновик вопроса на экране правки.
 *
 * <p>Отдельный тип от `HomeworkQuestionView` нужен ради `localId`: пока вопрос не
 * сохранён, идентификатора у него нет, а React нужен устойчивый ключ. По индексу
 * ключевать нельзя — перестановка стрелками перемешала бы поля местами.
 */
export interface QuestionDraft {
  localId: string;
  /** Идентификатор с сервера; отсутствует у только что добавленного вопроса. */
  id?: number;
  type: HomeworkQuestionType;
  text: string;
  maxScore: number;
  referenceAnswer: string;
  gradingCriteria: string;
  aiGenerated: boolean;
  options: OptionDraft[];
}

export interface OptionDraft {
  localId: string;
  text: string;
  correct: boolean;
}

export type HomeworkQuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'OPEN_TEXT';

export const QUESTION_TYPES: HomeworkQuestionType[] = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'OPEN_TEXT',
];

export const QUESTION_TYPE_LABELS: Record<HomeworkQuestionType, string> = {
  SINGLE_CHOICE: 'Один ответ',
  MULTIPLE_CHOICE: 'Несколько ответов',
  OPEN_TEXT: 'Развёрнутый ответ',
};

export function isChoiceType(type: HomeworkQuestionType): boolean {
  return type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
}

let counter = 0;
export function newLocalId(): string {
  counter += 1;
  return `q-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyQuestion(): QuestionDraft {
  return {
    localId: newLocalId(),
    type: 'SINGLE_CHOICE',
    text: '',
    maxScore: 1,
    referenceAnswer: '',
    gradingCriteria: '',
    aiGenerated: false,
    options: [
      { localId: newLocalId(), text: '', correct: true },
      { localId: newLocalId(), text: '', correct: false },
    ],
  };
}

export function toDraft(question: HomeworkQuestion): QuestionDraft {
  return {
    localId: newLocalId(),
    id: question.id,
    type: (question.type ?? 'SINGLE_CHOICE') as HomeworkQuestionType,
    text: question.text ?? '',
    maxScore: Number(question.maxScore ?? 1),
    referenceAnswer: question.referenceAnswer ?? '',
    gradingCriteria: question.gradingCriteria ?? '',
    aiGenerated: question.aiGenerated ?? false,
    options: (question.options ?? []).map((option) => ({
      localId: newLocalId(),
      text: option.text ?? '',
      correct: option.correct ?? false,
    })),
  };
}

/** Тело `PUT /questions`: набор заменяется целиком, частичного сохранения нет. */
export function toRequest(questions: QuestionDraft[]): SaveQuestionsRequest {
  return {
    questions: questions.map((question) => ({
      type: question.type,
      text: question.text.trim(),
      maxScore: question.maxScore,
      referenceAnswer: question.referenceAnswer.trim() || undefined,
      gradingCriteria: question.gradingCriteria.trim() || undefined,
      options: isChoiceType(question.type)
        ? question.options.map((option) => ({ text: option.text.trim(), correct: option.correct }))
        : [],
    })),
  };
}

/**
 * Правила те же, что на бэкенде (`HomeworkQuestionService.validate`).
 *
 * <p>Повторены здесь не ради дублирования, а ради момента: кнопка «Сохранить» обязана
 * объяснить, чего не хватает, до нажатия. Отказ после нажатия — это то же знание,
 * доставленное позже и грубее. Бэкенд остаётся источником правды и проверяет заново.
 *
 * @returns сообщения по индексу вопроса; пустая карта — можно сохранять
 */
export function validateQuestions(questions: QuestionDraft[]): Map<number, string[]> {
  const problems = new Map<number, string[]>();

  questions.forEach((question, index) => {
    const messages: string[] = [];

    if (!question.text.trim()) {
      messages.push('Текст вопроса пустой');
    }
    if (!(question.maxScore > 0)) {
      messages.push('Балл за вопрос должен быть больше нуля');
    }

    if (isChoiceType(question.type)) {
      const filled = question.options.filter((option) => option.text.trim());
      if (filled.length < 2) {
        messages.push('Нужно минимум два варианта ответа');
      }
      const correct = question.options.filter((option) => option.correct).length;
      if (question.type === 'SINGLE_CHOICE' && correct !== 1) {
        messages.push('Отметьте ровно один правильный вариант');
      }
      if (question.type === 'MULTIPLE_CHOICE' && correct < 1) {
        messages.push('Отметьте хотя бы один правильный вариант');
      }
    }

    if (messages.length > 0) problems.set(index, messages);
  });

  return problems;
}

/** Переставить вопрос на шаг вверх или вниз; за границами список не меняется. */
export function move(questions: QuestionDraft[], index: number, delta: -1 | 1): QuestionDraft[] {
  const target = index + delta;
  if (target < 0 || target >= questions.length) return questions;
  const next = [...questions];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Сменить тип вопроса.
 *
 * <p>У закрытого должны быть варианты, у открытого их не бывает вовсе — иначе бэкенд
 * ответит отказом. Заводим два пустых варианта, а не один: вопрос с единственным
 * вариантом бессмыслен и всё равно не пройдёт проверку.
 */
export function withType(question: QuestionDraft, type: HomeworkQuestionType): QuestionDraft {
  if (!isChoiceType(type)) {
    return { ...question, type, options: [] };
  }
  const options =
    question.options.length >= 2
      ? question.options
      : [
          { localId: newLocalId(), text: '', correct: true },
          { localId: newLocalId(), text: '', correct: false },
        ];
  return { ...question, type, options };
}

/** Отметить правильный вариант: у «одного ответа» отметка одна, у «нескольких» — переключается. */
export function withCorrect(question: QuestionDraft, optionIndex: number): QuestionDraft {
  const options = question.options.map((option, index) => {
    if (question.type === 'SINGLE_CHOICE') return { ...option, correct: index === optionIndex };
    if (index === optionIndex) return { ...option, correct: !option.correct };
    return option;
  });
  return { ...question, options };
}
