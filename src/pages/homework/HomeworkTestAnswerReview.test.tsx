import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeworkTestAnswerReview } from './HomeworkTestAnswerReview';

const useLastGradeSuggestion = vi.fn();
const useAiRecommendation = vi.fn();
const useHomeworkAiQuota = vi.fn();
const useSetAnswerScores = vi.fn();
const useSuggestGrades = vi.fn();

vi.mock('@/lib/homeworkAiApi', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  homeworkAnswersApi: { photoBlob: vi.fn().mockResolvedValue(new Blob()) },
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ push: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('@/hooks/queries', () => ({
  useLastGradeSuggestion: (...args: unknown[]) => useLastGradeSuggestion(...args),
  useAiRecommendation: (...args: unknown[]) => useAiRecommendation(...args),
  useHomeworkAiQuota: (...args: unknown[]) => useHomeworkAiQuota(...args),
  useSetAnswerScores: (...args: unknown[]) => useSetAnswerScores(...args),
  useSuggestGrades: (...args: unknown[]) => useSuggestGrades(...args),
}));

function closedAnswer(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    questionId: 1,
    type: 'SINGLE_CHOICE',
    questionText: 'Какой ответ верный?',
    maxScore: 1,
    selectedOptionIds: [12],
    correctOptionIds: [11],
    autoScore: 0,
    finalScore: null,
    ...overrides,
  };
}

function openAnswer(overrides: Record<string, unknown> = {}) {
  return {
    id: 20,
    questionId: 2,
    type: 'OPEN_TEXT',
    questionText: 'Объясните, что такое плотность.',
    maxScore: 2,
    openText: 'Это масса на объём.',
    referenceAnswer: 'Масса, делённая на объём.',
    gradingCriteria: 'Названы обе величины.',
    aiSuggestedScore: 1.5,
    aiRationale: 'Верно названо соотношение, но не указаны единицы.',
    finalScore: null,
    ...overrides,
  };
}

const questions = [
  {
    id: 1,
    type: 'SINGLE_CHOICE',
    text: 'Какой ответ верный?',
    options: [
      { id: 11, text: 'Верный вариант', correct: true },
      { id: 12, text: 'Выбранный неверный вариант', correct: false },
    ],
  },
  { id: 2, type: 'OPEN_TEXT', text: 'Объясните, что такое плотность.', options: [] },
];

function renderReview(overrides: Partial<Parameters<typeof HomeworkTestAnswerReview>[0]> = {}) {
  render(
    <HomeworkTestAnswerReview
      homeworkId={5}
      studentProfileId={7}
      answers={[closedAnswer(), openAnswer()]}
      questions={questions}
      onRetryQuestions={vi.fn()}
      onRefreshAnswers={vi.fn()}
      {...overrides}
    />,
  );
}

describe('HomeworkTestAnswerReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Состояние задачи приходит с сервера: своего хранилища у экрана нет.
    useLastGradeSuggestion.mockReturnValue({ data: undefined, refetch: vi.fn() });
    useAiRecommendation.mockReturnValue({ data: undefined, refetch: vi.fn() });
    useHomeworkAiQuota.mockReturnValue({ data: { enabled: true, remaining: 20 } });
    useSuggestGrades.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    useSetAnswerScores.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue([closedAnswer(), openAnswer({ finalScore: 1.5 })]),
      isPending: false,
    });
  });

  /** Главный инвариант FE-W5: три балла различимы до того, как учитель что-то сохранил. */
  it('разделяет автопроверку, рекомендацию ИИ и поле решения учителя', () => {
    renderReview();

    expect(screen.getByText('Автопроверка')).toBeInTheDocument();
    expect(screen.getByText('0 / 1')).toBeInTheDocument();
    expect(screen.getByText('Предлагает ИИ')).toBeInTheDocument();
    expect(screen.getByText('Верно названо соотношение, но не указаны единицы.')).toBeInTheDocument();
    expect(screen.getByText('1,5 / 2')).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton', { name: /Балл учителя/ })).toHaveLength(2);
    expect(screen.getByText(/оценка в журнале — разные действия/)).toBeInTheDocument();
  });

  it('подставляет рекомендацию только по явному действию и сохраняет её как решение учителя', async () => {
    const user = userEvent.setup();
    const mutation = useSetAnswerScores().mutateAsync as ReturnType<typeof vi.fn>;
    renderReview();

    await user.click(screen.getByRole('button', { name: 'Принять предложенное' }));
    const inputs = screen.getAllByRole('spinbutton', { name: /Балл учителя/ });
    expect(inputs[1]).toHaveValue(1.5);

    const saveButtons = screen.getAllByRole('button', { name: 'Сохранить балл' });
    await user.click(saveButtons[1]);

    await waitFor(() =>
      expect(mutation).toHaveBeenCalledWith({
        items: [{ answerId: 20, finalScore: 1.5, comment: undefined }],
      }),
    );
  });

  /**
   * Задачу мог начать этот же учитель в другом окне или на телефоне. Экран обязан её
   * показать: раньше идентификатор жил в localStorage, и на втором устройстве кнопка
   * выглядела нетронутой — второе нажатие стоило вторых денег.
   */
  it('показывает задачу, начатую в другом окне, вместо свободной кнопки', () => {
    useLastGradeSuggestion.mockReturnValue({
      data: { id: 42, status: 'RUNNING', phase: 'CALLING_MODEL', progressDone: 1, progressTotal: 3 },
      refetch: vi.fn(),
    });
    renderReview();

    expect(screen.getByRole('button', { name: /Проверяю ответы/ })).toBeDisabled();
  });

  /**
   * Снимок решения показывается рядом со своим вопросом, а не в общем списке вложений
   * работы: учитель проверяет по одной задаче за раз.
   */
  it('показывает фотографии решения при открытом ответе', async () => {
    renderReview({
      answers: [
        closedAnswer(),
        openAnswer({
          openText: '',
          photos: [{ id: 90, fileName: 'solution.jpg', contentType: 'image/jpeg', sizeBytes: 1024 }],
        }),
      ],
    });

    expect(await screen.findByLabelText('Фотографии решения')).toBeInTheDocument();
    expect(screen.getByText('Решение на фотографии')).toBeInTheDocument();
  });

  /**
   * Оценку выбрала школьная шкала, а не модель, и на карточке это должно быть сказано:
   * «рекомендует ИИ» иначе читается как «так решил компьютер».
   */
  it('показывает рекомендацию за работу вместе с оговоркой, что это не оценка', () => {
    useAiRecommendation.mockReturnValue({
      refetch: vi.fn(),
      data: {
        scaleCode: '4',
        summary: 'Работа выполнена в основном верно.',
        issues: ['не указаны единицы измерения'],
        score: 2.5,
        maxScore: 3,
        percent: 83,
        closedScore: 1,
        closedMax: 1,
      },
    });
    renderReview();

    const card = screen.getByLabelText('Рекомендация за работу');
    expect(card).toHaveTextContent('4');
    expect(card).toHaveTextContent('2,5 из 3 баллов');
    expect(card).toHaveTextContent('83%');
    expect(card).toHaveTextContent('не указаны единицы измерения');
    expect(card).toHaveTextContent(/в журнал ничего не попадёт/i);
    expect(card).toHaveTextContent(/ИИ их не пересматривал/i);
  });

  /** Порогов нет — рекомендация остаётся баллами, а оценку выбирает учитель. */
  it('без порогов шкалы показывает баллы, но не называет оценку', () => {
    useAiRecommendation.mockReturnValue({
      refetch: vi.fn(),
      data: {
        scaleCode: null,
        summary: 'Решение верное.',
        issues: [],
        score: 3,
        maxScore: 3,
        percent: 100,
        closedScore: 0,
        closedMax: 0,
      },
    });
    renderReview();

    const card = screen.getByLabelText('Рекомендация за работу');
    expect(card).toHaveTextContent(/школа не задала пороги/i);
    expect(card).not.toHaveTextContent(/закрытые вопросы/i);
  });

  it('при выключенном ИИ объясняет это и не блокирует ручную проверку', () => {
    useHomeworkAiQuota.mockReturnValue({ data: { enabled: false, remaining: 0 } });
    renderReview();

    expect(screen.getByText(/Проверка ИИ сейчас недоступна/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Получить подсказки ИИ' })).toBeDisabled();
    expect(screen.getAllByRole('spinbutton', { name: /Балл учителя/ })[1]).toBeEnabled();
  });
});
