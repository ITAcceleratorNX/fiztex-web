import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddFromTestModal } from './AddFromTestModal';
import { useTestQuestions, useTests, useTestsByGrade } from '@/hooks/queries';
import type { QuestionResponse, Test } from '@/lib/types';

vi.mock('@/hooks/queries', () => ({
  useTests: vi.fn(),
  useTestsByGrade: vi.fn(),
  useTestQuestions: vi.fn(),
}));

function test(id: number, title: string, grade: string): Test {
  return {
    id,
    title,
    subjectId: 1,
    subjectName: 'Математика',
    grade,
    durationMinutes: 60,
    minScore: 1,
    maxScore: 20,
    minPercent: null,
    questionCount: 2,
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
  };
}

function question(id: number, text: string): QuestionResponse {
  return {
    id,
    topic: 'Алгебра',
    difficulty: null,
    type: 'SINGLE_CHOICE',
    text,
    maxScore: 1,
    allowPhoto: false,
    referenceAnswer: null,
    gradingCriteria: null,
    orderIndex: 0,
    isDraft: false,
    sourceQuestionId: null,
    imageUrl: null,
    options: [
      { id: 1, text: '1/4', isCorrect: true, orderIndex: 0 },
      { id: 2, text: '4', isCorrect: false, orderIndex: 1 },
    ],
  };
}

const CURRENT_TEST_ID = 100;
const SOURCE_TEST = test(7, 'Экзамен 8 класс В1', '8 класс');

function query<T>(data: T) {
  return { data, isLoading: false, isError: false, error: null, refetch: vi.fn() };
}

function setup(addedSourceIds: Set<number> = new Set()) {
  const onAdd = vi.fn();
  render(
    <AddFromTestModal
      open
      onClose={vi.fn()}
      currentTestId={CURRENT_TEST_ID}
      addedSourceIds={addedSourceIds}
      onAdd={onAdd}
    />,
  );
  return onAdd;
}

async function walkToQuestions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '8 класс' }));
  await user.click(screen.getByRole('button', { name: /Экзамен 8 класс В1/ }));
}

describe('AddFromTestModal', () => {
  beforeEach(() => {
    vi.mocked(useTests).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query([test(CURRENT_TEST_ID, 'Текущий тест', '8 класс'), SOURCE_TEST]) as any,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useTestsByGrade).mockReturnValue(query([test(CURRENT_TEST_ID, 'Текущий тест', '8 класс'), SOURCE_TEST]) as any);
    vi.mocked(useTestQuestions).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query([question(1, 'Вычислите 16³ · (2²)⁻³ : 32'), question(2, 'Найдите S₄')]) as any,
    );
  });

  afterEach(cleanup);

  it('идёт по цепочке класс → тест → вопрос и не предлагает текущий тест', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: '8 класс' }));

    expect(screen.getByRole('button', { name: /Экзамен 8 класс В1/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Текущий тест/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Экзамен 8 класс В1/ }));

    expect(screen.getByText('Вычислите 16³ · (2²)⁻³ : 32')).toBeInTheDocument();
  });

  it('добавляет вопрос вместе с тестом-источником', async () => {
    const user = userEvent.setup();
    const onAdd = setup();

    await walkToQuestions(user);
    await user.click(screen.getAllByRole('button', { name: /Добавить/ })[0]);

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].id).toBe(1);
    expect(onAdd.mock.calls[0][1].title).toBe('Экзамен 8 класс В1');
  });

  it('вместо «+» показывает «Уже добавлен» для уже скопированного вопроса', async () => {
    const user = userEvent.setup();
    const onAdd = setup(new Set([1]));

    await walkToQuestions(user);

    const first = screen.getByText('Вычислите 16³ · (2²)⁻³ : 32').closest('li') as HTMLElement;
    expect(within(first).getByText('Уже добавлен')).toBeInTheDocument();
    expect(within(first).queryByRole('button', { name: /Добавить/ })).not.toBeInTheDocument();

    // Соседний вопрос из того же теста добавить по-прежнему можно.
    const second = screen.getByText('Найдите S₄').closest('li') as HTMLElement;
    await user.click(within(second).getByRole('button', { name: /Добавить/ }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].id).toBe(2);
  });
});
