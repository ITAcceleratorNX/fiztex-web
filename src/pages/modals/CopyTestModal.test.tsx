import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyTestModal } from './CopyTestModal';
import { useCopyTest } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { Test } from '@/lib/types';

const toast = { success: vi.fn(), error: vi.fn() };

vi.mock('@/hooks/queries', () => ({
  useCopyTest: vi.fn(),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => toast,
}));

function aiTest(overrides: Partial<Test> = {}): Test {
  return {
    id: 42,
    title: 'AI: механика',
    subjectId: 7,
    subjectName: 'Физика',
    grade: '7 класс',
    durationMinutes: 45,
    minScore: 3,
    maxScore: 10,
    minPercent: 30,
    questionCount: 5,
    draftQuestionCount: 2,
    rules: null,
    status: 'DRAFT',
    allowBackNavigation: true,
    maxAttempts: 1,
    shuffleQuestions: false,
    shuffleOptions: false,
    useAiGeneration: true,
    showResultAfterReview: true,
    currentVersionNumber: 1,
    currentVersionCreatedAt: null,
    assignmentCount: 0,
    versions: [],
    assignments: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function mockCopy(mutateAsync: ReturnType<typeof vi.fn>) {
  vi.mocked(useCopyTest).mockReturnValue({
    isPending: false,
    mutateAsync,
  } as unknown as ReturnType<typeof useCopyTest>);
}

describe('CopyTestModal', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    toast.success.mockReset();
  });

  it('копирует без черновиков и отдаёт копию наверх', async () => {
    const user = userEvent.setup();
    const copy = aiTest({ id: 43, title: 'Вступительный по физике', useAiGeneration: false });
    const mutateAsync = vi.fn().mockResolvedValue(copy);
    mockCopy(mutateAsync);
    const onCopied = vi.fn();

    render(<CopyTestModal open onClose={vi.fn()} test={aiTest()} onCopied={onCopied} />);

    // По умолчанию берём только проверенные вопросы.
    expect(screen.getByText('5 вопросов')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Скопировать/ }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        id: 42,
        body: { title: 'AI: механика (копия)', includeDrafts: false },
      }),
    );
    expect(onCopied).toHaveBeenCalledWith(copy);
    expect(toast.success).toHaveBeenCalled();
  });

  it('по переключателю берёт и черновики', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(aiTest({ id: 43 }));
    mockCopy(mutateAsync);

    render(<CopyTestModal open onClose={vi.fn()} test={aiTest()} onCopied={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Взять и черновики \(2\)/ }));
    expect(screen.getByText('7 вопросов')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Скопировать/ }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.objectContaining({ includeDrafts: true }) }),
      ),
    );
  });

  it('не даёт копировать тест без проверенных вопросов', async () => {
    const mutateAsync = vi.fn();
    mockCopy(mutateAsync);

    render(
      <CopyTestModal
        open
        onClose={vi.fn()}
        test={aiTest({ questionCount: 0, draftQuestionCount: 0 })}
        onCopied={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Скопировать/ })).toBeDisabled();
    expect(screen.getByText(/Копировать нечего/)).toBeInTheDocument();
  });

  it('показывает ошибку бэка вместо закрытия окна', async () => {
    const user = userEvent.setup();
    mockCopy(vi.fn().mockRejectedValue(new ApiError(400, 'В тесте нет проверенных вопросов')));
    const onCopied = vi.fn();

    render(<CopyTestModal open onClose={vi.fn()} test={aiTest()} onCopied={onCopied} />);
    await user.click(screen.getByRole('button', { name: /Скопировать/ }));

    await waitFor(() =>
      expect(screen.getByText('В тесте нет проверенных вопросов')).toBeInTheDocument(),
    );
    expect(onCopied).not.toHaveBeenCalled();
  });
});
