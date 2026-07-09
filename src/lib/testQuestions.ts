import type { QuestionDifficulty, QuestionRequest, QuestionResponse, QuestionType, Test, TestRequest, VersionStrategy } from './types';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Один вариант',
  MULTIPLE_CHOICE: 'Несколько вариантов',
  OPEN_TEXT: 'Открытый ответ',
  PHOTO: 'Фото',
};

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
  topic: string;
  difficulty: QuestionDifficulty | '';
  type: QuestionType;
  text: string;
  maxScore: number;
  allowPhoto: boolean;
  referenceAnswer: string;
  gradingCriteria: string;
  options: AnswerOptionDraft[];
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
    topic: '',
    difficulty: '',
    type,
    text: '',
    maxScore: 1,
    allowPhoto: type === 'PHOTO',
    referenceAnswer: '',
    gradingCriteria: '',
    options: isChoiceType(type)
      ? [
          { localId: newLocalId(), text: '', isCorrect: true },
          { localId: newLocalId(), text: '', isCorrect: false },
        ]
      : [],
  };
}

export function questionFromResponse(q: QuestionResponse): QuestionDraft {
  return {
    localId: newLocalId(),
    topic: q.topic ?? '',
    difficulty: normalizeDifficulty(q.difficulty),
    type: q.type,
    text: q.text,
    maxScore: q.maxScore,
    allowPhoto: q.allowPhoto,
    referenceAnswer: q.referenceAnswer ?? '',
    gradingCriteria: q.gradingCriteria ?? '',
    options: (q.options ?? []).map((o) => ({
      localId: newLocalId(),
      text: o.text,
      isCorrect: o.isCorrect,
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
    options: isChoiceType(q.type)
      ? q.options.map((o, i) => ({
          text: o.text.trim(),
          isCorrect: o.isCorrect,
          orderIndex: i,
        }))
      : undefined,
  };
}

export function validateQuestions(questions: QuestionDraft[]): string | null {
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
    versionStrategy,
    questions,
  };
}
