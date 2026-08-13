import type { QuestionDifficulty, QuestionRequest, QuestionResponse, QuestionType, Test, TestRequest, VersionStrategy } from './types';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Один вариант',
  MULTIPLE_CHOICE: 'Несколько вариантов',
  OPEN_TEXT: 'Открытый ответ',
  // Legacy: kept only for labelling old data. New questions use OPEN_TEXT + allowPhoto.
  PHOTO: 'Открытый ответ',
};

/** Types offered in the question editor. «Фото» is folded into «Открытый ответ» + переключатель. */
export const SELECTABLE_QUESTION_TYPES: QuestionType[] = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'OPEN_TEXT',
];

export const QUESTION_DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  EASY: 'Лёгкий',
  MEDIUM: 'Средний',
  HARD: 'Сложный',
};

export const QUESTION_DIFFICULTIES: QuestionDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

export function difficultyLabel(value: QuestionDifficulty | null | undefined): string | null {
  if (!value) return null;
  return QUESTION_DIFFICULTY_LABELS[value] ?? null;
}

export function normalizeDifficulty(value: string | null | undefined): QuestionDifficulty | '' {
  if (!value) return '';
  const upper = value.toUpperCase();
  if (upper === 'EASY' || upper === 'MEDIUM' || upper === 'HARD') return upper as QuestionDifficulty;
  const lower = value.toLowerCase();
  if (lower.includes('лёг') || lower.includes('лег') || lower.includes('easy')) return 'EASY';
  if (lower.includes('сред') || lower.includes('medium')) return 'MEDIUM';
  if (lower.includes('слож') || lower.includes('hard')) return 'HARD';
  return '';
}

export function isChoiceType(type: QuestionType): boolean {
  return type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
}

export interface QuestionDraft {
  localId: string;
  /**
   * Идентификатор вопроса на сервере, или `null` у ещё не сохранённого. Нужен ровно для
   * рисунка: он загружается своим эндпоинтом и до первого сохранения вопроса прикрепить его
   * некуда.
   */
  id: number | null;
  /** Presigned-ссылка на прикреплённый рисунок, если он есть. */
  imageUrl: string | null;
  isDraft: boolean;
  topic: string;
  difficulty: QuestionDifficulty | '';
  type: QuestionType;
  text: string;
  maxScore: number;
  allowPhoto: boolean;
  referenceAnswer: string;
  gradingCriteria: string;
  options: AnswerOptionDraft[];
  /** Вопрос-источник, если это копия из другого теста. Уходит на сервер при сохранении. */
  sourceQuestionId: number | null;
  /** Откуда скопировано — подпись в карточке до сохранения. На сервер не уходит. */
  sourceTestTitle?: string;
  /** Вариант, созданный AI и ещё не сохранённый. На сервер не уходит. */
  isAiVariant?: boolean;
}

export function countDraftQuestions(questions: QuestionResponse[] | undefined): number {
  return (questions ?? []).filter((q) => q.isDraft).length;
}

export function countTestsWithDrafts(tests: Test[] | undefined): number {
  return (tests ?? []).filter((t) => t.draftQuestionCount > 0).length;
}

export interface AnswerOptionDraft {
  localId: string;
  text: string;
  isCorrect: boolean;
}

export function newLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyQuestion(type: QuestionType = 'SINGLE_CHOICE'): QuestionDraft {
  return {
    localId: newLocalId(),
    id: null,
    imageUrl: null,
    isDraft: false,
    topic: '',
    difficulty: '',
    type,
    text: '',
    maxScore: 1,
    allowPhoto: type === 'PHOTO',
    referenceAnswer: '',
    gradingCriteria: '',
    sourceQuestionId: null,
    options: isChoiceType(type)
      ? [
          { localId: newLocalId(), text: '', isCorrect: true },
          { localId: newLocalId(), text: '', isCorrect: false },
        ]
      : [],
  };
}

export function questionFromResponse(q: QuestionResponse): QuestionDraft {
  // Legacy «Фото» questions collapse into «Открытый ответ» with photos enabled.
  const isLegacyPhoto = q.type === 'PHOTO';
  return {
    localId: newLocalId(),
    id: q.id,
    imageUrl: q.imageUrl ?? null,
    isDraft: q.isDraft,
    topic: q.topic ?? '',
    difficulty: normalizeDifficulty(q.difficulty),
    type: isLegacyPhoto ? 'OPEN_TEXT' : q.type,
    text: q.text,
    maxScore: q.maxScore,
    allowPhoto: isLegacyPhoto ? true : q.allowPhoto,
    referenceAnswer: q.referenceAnswer ?? '',
    gradingCriteria: q.gradingCriteria ?? '',
    sourceQuestionId: q.sourceQuestionId ?? null,
    options: (q.options ?? []).map((o) => ({
      localId: newLocalId(),
      text: o.text,
      isCorrect: o.isCorrect,
    })),
  };
}

/**
 * Копия вопроса из другого теста. Копия независима: сервер получает её как обычный вопрос,
 * а связь с оригиналом хранится только для защиты от повторного добавления.
 */
export function questionFromOtherTest(q: QuestionResponse, sourceTestTitle: string): QuestionDraft {
  return {
    ...questionFromResponse(q),
    // Копия — новый вопрос: своего id у неё пока нет, а рисунок оригинала останется у оригинала.
    id: null,
    imageUrl: null,
    isDraft: false,
    sourceQuestionId: q.id,
    sourceTestTitle,
  };
}

/** Вариант, созданный AI: приходит уже в виде запроса, остаётся разложить его в черновик. */
export function questionFromVariant(variant: QuestionRequest): QuestionDraft {
  return {
    localId: newLocalId(),
    id: null,
    imageUrl: null,
    isDraft: false,
    isAiVariant: true,
    topic: variant.topic ?? '',
    difficulty: normalizeDifficulty(variant.difficulty),
    type: variant.type,
    text: variant.text,
    maxScore: variant.maxScore,
    allowPhoto: variant.allowPhoto ?? false,
    referenceAnswer: variant.referenceAnswer ?? '',
    gradingCriteria: variant.gradingCriteria ?? '',
    sourceQuestionId: null,
    options: (variant.options ?? []).map((o) => ({
      localId: newLocalId(),
      text: o.text,
      isCorrect: Boolean(o.isCorrect),
    })),
  };
}

export function questionToRequest(q: QuestionDraft, orderIndex: number): QuestionRequest {
  return {
    topic: q.topic.trim() || null,
    difficulty: q.difficulty || null,
    type: q.type,
    text: q.text.trim(),
    maxScore: q.maxScore,
    allowPhoto: q.allowPhoto,
    referenceAnswer: q.referenceAnswer.trim() || null,
    gradingCriteria: q.gradingCriteria.trim() || null,
    orderIndex,
    sourceQuestionId: q.sourceQuestionId,
    options: isChoiceType(q.type)
      ? q.options.map((o, i) => ({
          text: o.text.trim(),
          isCorrect: o.isCorrect,
          orderIndex: i,
        }))
      : undefined,
  };
}

export function validateQuestions(questions: QuestionDraft[], minScore?: number): string | null {
  if (questions.length === 0) return 'Добавьте хотя бы один вопрос';

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const n = i + 1;
    if (!q.text.trim()) return `Вопрос ${n}: укажите текст`;
    if (!Number.isFinite(q.maxScore) || q.maxScore < 1) return `Вопрос ${n}: балл должен быть ≥ 1`;

    if (isChoiceType(q.type)) {
      if (q.options.length < 2) return `Вопрос ${n}: нужно минимум 2 варианта ответа`;
      if (q.options.some((o) => !o.text.trim())) return `Вопрос ${n}: заполните все варианты ответа`;
      const correct = q.options.filter((o) => o.isCorrect).length;
      if (correct === 0) return `Вопрос ${n}: отметьте правильный ответ`;
      if (q.type === 'SINGLE_CHOICE' && correct !== 1) return `Вопрос ${n}: для одного варианта нужен ровно один правильный ответ`;
    }
  }

  if (minScore != null && Number.isFinite(minScore)) {
    const totalMax = questions
      .filter((q) => !q.isDraft)
      .reduce((sum, q) => sum + (Number.isFinite(q.maxScore) ? q.maxScore : 0), 0);
    if (totalMax > 0 && minScore > totalMax) {
      return `Минимальный балл (${minScore}) не может превышать сумму баллов вопросов (${totalMax})`;
    }
  }

  return null;
}

export function buildTestRequest(
  test: Test,
  questions: QuestionRequest[],
  versionStrategy?: VersionStrategy,
): TestRequest {
  return {
    title: test.title,
    subjectId: test.subjectId,
    grade: test.grade,
    durationMinutes: test.durationMinutes,
    minScore: test.minScore,
    rules: test.rules,
    status: test.status === 'COMPLETED' ? 'ACTIVE' : test.status,
    allowBackNavigation: test.allowBackNavigation,
    maxAttempts: test.maxAttempts,
    shuffleQuestions: test.shuffleQuestions,
    shuffleOptions: test.shuffleOptions,
    useAiGeneration: test.useAiGeneration,
    versionStrategy,
    questions,
  };
}
