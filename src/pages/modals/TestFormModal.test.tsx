import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestFormModal } from './TestFormModal';
import { useCreateTest, useSubjects, useUpdateTest } from '@/hooks/queries';

const toast = { success: vi.fn(), error: vi.fn() };

vi.mock('@/hooks/queries', () => ({
  useSubjects: vi.fn(),
  useCreateTest: vi.fn(),
  useUpdateTest: vi.fn(),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => toast,
}));

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

describe('TestFormModal', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    toast.success.mockReset();
    toast.error.mockReset();
    vi.mocked(useSubjects).mockReturnValue({
      data: [{ id: 1, name: 'Math', status: 'ACTIVE', testCount: 0, createdAt: '', description: null }],
    } as ReturnType<typeof useSubjects>);
    vi.mocked(useCreateTest).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as ReturnType<typeof useCreateTest>);
    vi.mocked(useUpdateTest).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as ReturnType<typeof useUpdateTest>);
  });

  it('renders activation violation list from 422 response', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockRejectedValue(
      apiError422([
        { questionOrderIndex: 0, code: 'SINGLE_CHOICE_CORRECT_COUNT', message: 'Вопрос 1: один правильный' },
        { questionOrderIndex: null, code: 'MIN_SCORE_UNREACHABLE', message: 'Минимальный балл слишком высок' },
      ]),
    );
    vi.mocked(useUpdateTest).mockReturnValue({
      isPending: false,
      mutateAsync,
    } as ReturnType<typeof useUpdateTest>);

    render(
      <TestFormModal
        open
        onClose={() => {}}
        test={{
          id: 5,
          title: 'Ready',
          subjectId: 1,
          subjectName: 'Math',
          grade: '5 класс',
          durationMinutes: 60,
          minScore: 1,
          maxScore: 1,
          minPercent: null,
          questionCount: 1,
          draftQuestionCount: 0,
          rules: null,
          status: 'DRAFT',
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
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Черновик/i }));
    await user.click(screen.getByRole('option', { name: 'Активен' }));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(screen.getByText('Вопрос 1: один правильный')).toBeInTheDocument();
      expect(screen.getByText('Минимальный балл слишком высок')).toBeInTheDocument();
    });
  });

  it('shows hint when activating test without questions', async () => {
    render(
      <TestFormModal
        open
        onClose={() => {}}
        test={{
          id: 5,
          title: 'Empty',
          subjectId: 1,
          subjectName: 'Math',
          grade: '5',
          durationMinutes: 60,
          minScore: 0,
          maxScore: 0,
          minPercent: null,
          questionCount: 0,
          draftQuestionCount: 0,
          rules: null,
          status: 'DRAFT',
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
        }}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Черновик/i }));
    await user.click(screen.getByRole('option', { name: 'Активен' }));

    expect(screen.getByText(/Добавьте хотя бы один вопрос, чтобы активировать тест/i)).toBeInTheDocument();
  });

  it('explains next step after creating non-ai test', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ id: 10 });
    vi.mocked(useCreateTest).mockReturnValue({
      isPending: false,
      mutateAsync,
    } as ReturnType<typeof useCreateTest>);

    render(<TestFormModal open onClose={() => {}} test={null} aiTest={false} />);

    await user.type(screen.getByPlaceholderText(/Например: Математика/i), 'Новый тест');
    await user.click(screen.getByRole('button', { name: 'Выберите предмет…' }));
    await user.click(screen.getByRole('option', { name: /Math/ }));
    await user.type(screen.getByPlaceholderText(/Например: 5 класс/i), '5 класс');
    await user.click(screen.getByRole('button', { name: 'Создать тест' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Новый тест',
          subjectId: 1,
          grade: '5 класс',
        }),
      );
      expect(toast.success).toHaveBeenCalledWith('Карточка теста создана. Теперь добавьте вопросы.');
    });
  });
});
