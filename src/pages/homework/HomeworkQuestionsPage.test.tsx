import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeworkQuestionsPage } from './HomeworkQuestionsPage';

const useHomeworkQuestions = vi.fn();
const useHomeworkAiJob = vi.fn();
const cardQuery = vi.fn();

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ push: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const idleMutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({ id: 1 }),
  isPending: false,
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: unknown[] }) => cardQuery(options),
}));

vi.mock('@/hooks/queries', () => ({
  useHomeworkQuestions: (...args: unknown[]) => useHomeworkQuestions(...args),
  useHomeworkAiJob: (...args: unknown[]) => useHomeworkAiJob(...args),
  useSaveHomeworkQuestions: () => idleMutation(),
  useRegenerateQuestion: () => idleMutation(),
}));

function question(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    orderIndex: 0,
    type: 'SINGLE_CHOICE',
    text: 'Что такое плотность?',
    maxScore: 1,
    aiGenerated: false,
    options: [
      { id: 11, text: 'Масса на объём', correct: true, orderIndex: 0 },
      { id: 12, text: 'Объём на массу', correct: false, orderIndex: 1 },
    ],
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/homework/5/questions']}>
      <Routes>
        <Route path="/homework/:homeworkId/questions" element={<HomeworkQuestionsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HomeworkQuestionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cardQuery.mockReturnValue({
      data: { id: 5, title: 'Тест по плотности', status: 'DRAFT', hasAnswers: false },
    });
    useHomeworkQuestions.mockReturnValue({ data: [question()], isPending: false, isError: false });
    useHomeworkAiJob.mockReturnValue({ data: undefined });
  });

  it('показывает вопрос с вариантами и отметкой правильного', () => {
    renderPage();
    expect(screen.getByText('Вопрос 1')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Вариант 1 правильный' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Вариант 2 правильный' })).not.toBeChecked();
  });

  /** Машинный вопрос помечен, но не выделен цветом: десять из десяти превратят фон в фон. */
  it('машинный вопрос помечен', () => {
    useHomeworkQuestions.mockReturnValue({
      data: [question({ aiGenerated: true })],
      isPending: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText('Сгенерировано ИИ')).toBeInTheDocument();
  });

  /**
   * Главное правило экрана: выключенные кнопки без объяснения читаются как поломка.
   */
  it('после первых ответов объясняет, почему нельзя править', () => {
    cardQuery.mockReturnValue({
      data: { id: 5, title: 'Тест', status: 'PUBLISHED', hasAnswers: true },
    });
    renderPage();

    expect(screen.getByText(/уже есть ответы учеников/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сохранить' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Удалить вопрос' })).not.toBeInTheDocument();
  });

  it('завершённое задание тоже только для чтения, но причина другая', () => {
    cardQuery.mockReturnValue({
      data: { id: 5, title: 'Тест', status: 'COMPLETED', hasAnswers: false },
    });
    renderPage();
    expect(screen.getByText(/не редактируется/)).toBeInTheDocument();
  });

  /** Сохранять нечего, пока ничего не меняли: кнопка выключена сразу после загрузки. */
  it('без правок кнопка сохранения выключена', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('пустой список зовёт добавить вопрос', () => {
    useHomeworkQuestions.mockReturnValue({ data: [], isPending: false, isError: false });
    renderPage();
    expect(screen.getByText('Вопросов пока нет')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить вопрос' })).toBeInTheDocument();
  });

  /** Кнопка не про происхождение вопроса, а про «этот мне не нравится». */
  it('заменить вопрос предлагает и у написанного руками', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Заменить вопрос' })).toBeInTheDocument();
  });

  it('ошибку загрузки показывает с повтором', () => {
    useHomeworkQuestions.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/Не удалось загрузить вопросы/)).toBeInTheDocument();
  });
});
