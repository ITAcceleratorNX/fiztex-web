import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestQuestionsModal } from './TestQuestionsModal';
import { useTest, useUpdateTest } from '@/hooks/queries';
import type { Test } from '@/lib/types';

vi.mock('@/hooks/queries', () => ({
  useTest: vi.fn(),
  useUpdateTest: vi.fn(),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const baseTest: Test = {
  id: 10,
  title: 'Activation test',
  subjectId: 1,
  subjectName: 'Math',
  grade: '7 класс',
  durationMinutes: 30,
  minScore: 1,
  maxScore: 2,
  minPercent: null,
  questionCount: 2,
  rules: null,
  status: 'ACTIVE',
  allowBackNavigation: true,
  maxAttempts: 1,
  shuffleQuestions: false,
  shuffleOptions: false,
  useAiGeneration: false,
  showResultAfterReview: true,
  currentVersionNumber: 1,
  currentVersionCreatedAt: '',
  assignmentCount: 0,
  versions: [],
  assignments: [],
  createdAt: '',
  updatedAt: '',
  questions: [
    {
      id: 1,
      topic: null,
      difficulty: null,
      type: 'SINGLE_CHOICE',
      text: 'Valid question',
      maxScore: 1,
      allowPhoto: false,
      referenceAnswer: null,
      gradingCriteria: null,
      orderIndex: 0,
      isDraft: false,
      options: [
        { id: 1, text: '3', isCorrect: false, orderIndex: 0 },
        { id: 2, text: '4', isCorrect: true, orderIndex: 1 },
      ],
    },
    {
      id: 2,
      topic: null,
      difficulty: null,
      type: 'OPEN_TEXT',
      text: 'Bad open',
      maxScore: 1,
      allowPhoto: false,
      referenceAnswer: null,
      gradingCriteria: null,
      orderIndex: 1,
      isDraft: false,
      options: [],
    },
  ],
};

function apiError422(details: unknown) {
  const err = new Error('Тест нельзя активировать') as Error & {
    name: string;
    status: number;
    code: string;
    details?: unknown;
  };
  err.name = 'ApiError';
  err.status = 422;
  err.code = 'TEST_ACTIVATION_INVALID';
  err.details = details;
  return err;
}

describe('TestQuestionsModal activation errors', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTest).mockReturnValue({
      data: baseTest,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useTest>);
    vi.mocked(useUpdateTest).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as ReturnType<typeof useUpdateTest>);
  });

  it('highlights invalid question card from 422 violations', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    vi.mocked(useUpdateTest).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockRejectedValue(
        apiError422([
          {
            questionOrderIndex: 1,
            code: 'OPEN_TEXT_GRADING_HINT_MISSING',
            message: 'Вопрос 2: укажите эталонный ответ или критерии оценки',
          },
        ]),
      ),
    } as ReturnType<typeof useUpdateTest>);

    render(<TestQuestionsModal open onClose={() => {}} testId={10} />);

    await user.click(screen.getByRole('button', { name: 'Сохранить вопросы' }));

    await waitFor(() => {
      expect(screen.getByText('Невалиден')).toBeInTheDocument();
      expect(screen.getByText(/укажите эталонный ответ или критерии оценки/i)).toBeInTheDocument();
    });

    const invalidCard = document.getElementById('question-card-1');
    expect(invalidCard).toBeTruthy();
    expect(invalidCard?.className).toContain('border-red-300');

    const validCard = document.getElementById('question-card-0');
    expect(within(validCard as HTMLElement).queryByText('Невалиден')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });
});
