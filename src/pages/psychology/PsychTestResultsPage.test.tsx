import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PsychTestResultsPage } from './PsychTestResultsPage';
import { useClosePsychTestAssignment, usePsychTestResults } from '@/hooks/psychTestQueries';
import type { PsychTestResults } from '@/lib/psychTestsApi';

const toast = { success: vi.fn(), error: vi.fn() };

vi.mock('@/hooks/psychTestQueries', () => ({
  usePsychTestResults: vi.fn(),
  useClosePsychTestAssignment: vi.fn(),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => toast,
}));

const RESULTS: PsychTestResults = {
  assignment: {
    id: 9,
    testId: 3,
    testTitle: 'Тревожность',
    status: 'ACTIVE',
    acceptingAnswers: true,
    createdAt: '2026-09-15T05:00:00Z',
    classes: [
      { id: 1, name: '7А' },
      { id: 2, name: '7Б' },
    ],
    recipientsTotal: 2,
    completedCount: 1,
    inProgressCount: 0,
  },
  questions: [
    {
      id: 101,
      orderIndex: 0,
      type: 'SINGLE_CHOICE',
      text: 'Как часто вы чувствуете тревогу?',
      options: [
        { id: 1, text: 'Редко' },
        { id: 2, text: 'Иногда' },
      ],
    },
    { id: 102, orderIndex: 1, type: 'OPEN_TEXT', text: 'Что вас беспокоит?', options: [] },
  ],
  students: [
    {
      studentId: 11,
      studentName: 'Иванова Анна',
      classId: 1,
      className: '7А',
      status: 'COMPLETED',
      submittedAt: '2026-09-15T07:30:00Z',
      answers: [
        { questionId: 101, selectedOptionIds: [2] },
        { questionId: 102, openText: 'Экзамены' },
      ],
    },
    { studentId: 12, studentName: 'Петров Пётр', classId: 2, className: '7Б', status: 'NOT_STARTED', answers: [] },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/psychologist/tests/3/assignments/9']}>
      <Routes>
        <Route path="/psychologist/tests/:testId/assignments/:assignmentId" element={<PsychTestResultsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PsychTestResultsPage', () => {
  const close = vi.fn();

  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePsychTestResults).mockReturnValue({
      data: RESULTS,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof usePsychTestResults>);
    close.mockResolvedValue({});
    vi.mocked(useClosePsychTestAssignment).mockReturnValue({
      isPending: false,
      mutateAsync: close,
    } as unknown as ReturnType<typeof useClosePsychTestAssignment>);
  });

  it('раскрывает ответы только у отправившего ученика', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { name: 'Тревожность' })).toBeInTheDocument();
    const completedRow = screen.getByText('Иванова Анна').closest('tr') as HTMLElement;
    expect(within(completedRow).getByText('Пройдено')).toBeInTheDocument();
    const notStartedRow = screen.getByText('Петров Пётр').closest('tr') as HTMLElement;
    expect(within(notStartedRow).getByText('Не начато')).toBeInTheDocument();

    expect(screen.queryByText('Экзамены')).not.toBeInTheDocument();
    await user.click(completedRow);
    expect(screen.getByText('Иногда')).toBeInTheDocument();
    expect(screen.getByText('Экзамены')).toBeInTheDocument();

    // Строка без отправки не раскрывается: черновика сервер не отдаёт.
    await user.click(notStartedRow);
    expect(screen.getAllByText('Как часто вы чувствуете тревогу?', { exact: false })).toHaveLength(1);
  });

  it('фильтр класса уходит в запрос, а не отбирается на клиенте', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Класс' }));
    await user.click(screen.getByRole('option', { name: '7Б' }));
    await waitFor(() => expect(usePsychTestResults).toHaveBeenLastCalledWith(9, 2));
  });

  it('закрывает приём после подтверждения', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Закрыть приём' }));
    const dialogButtons = screen.getAllByRole('button', { name: 'Закрыть приём' });
    await user.click(dialogButtons[dialogButtons.length - 1]);

    await waitFor(() => expect(close).toHaveBeenCalledWith(9));
    expect(toast.success).toHaveBeenCalledWith('Приём ответов закрыт');
  });
});
