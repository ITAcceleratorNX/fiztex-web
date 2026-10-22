import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubmissionAiReview } from './SubmissionAiReview';

const useAiGradeSuggestion = vi.fn();
const confirmPhotoReview = vi.fn();

vi.mock('./useAiGradeSuggestion', () => ({
  useAiGradeSuggestion: (...args: unknown[]) => useAiGradeSuggestion(...args),
}));
vi.mock('@/lib/homeworkAiApi', () => ({
  homeworkAiApi: { confirmPhotoReview: (...args: unknown[]) => confirmPhotoReview(...args) },
}));

function ai(overrides: Record<string, unknown> = {}) {
  return {
    job: undefined,
    isRunning: false,
    starting: false,
    start: vi.fn(),
    recommendation: undefined,
    unavailableText: null,
    ...overrides,
  };
}

/**
 * Проверка ИИ на экране обычного задания (AIGRADE-006). У такой работы нет ни вопросов,
 * ни баллов, поэтому весь ИИ здесь — одна кнопка и одна карточка.
 */
describe('SubmissionAiReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAiGradeSuggestion.mockReturnValue(ai());
    confirmPhotoReview.mockResolvedValue({});
  });

  it('одна кнопка на всю работу, а не по частям', async () => {
    const user = userEvent.setup();
    const start = vi.fn();
    useAiGradeSuggestion.mockReturnValue(ai({ start }));

    render(<SubmissionAiReview homeworkId={5} studentProfileId={7} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);

    await user.click(buttons[0]);
    expect(start).toHaveBeenCalledOnce();
  });

  /** У обычной работы баллов нет: карточка говорит процентом, а не выдуманной суммой. */
  it('показывает рекомендацию процентом выполнения', () => {
    useAiGradeSuggestion.mockReturnValue(
      ai({
        recommendation: {
          basis: 'COMPLETENESS',
          scaleCode: '4',
          summary: 'Решение верное, не хватает единиц.',
          issues: ['нет единиц измерения'],
          score: 70,
          maxScore: 100,
          percent: 70,
          closedScore: 0,
          closedMax: 0,
        },
      }),
    );

    render(<SubmissionAiReview homeworkId={5} studentProfileId={7} />);

    const card = screen.getByLabelText('Рекомендация за работу');
    expect(card).toHaveTextContent('Выполнено на 70%');
    expect(card).not.toHaveTextContent(/баллов/);
    expect(card).toHaveTextContent('4');
  });

  /** Отказ ИИ не блокирует ручную проверку — это AC-9 и главный инвариант фичи. */
  it('недоступный ИИ объясняется и выключает только кнопку', () => {
    useAiGradeSuggestion.mockReturnValue(
      ai({ unavailableText: 'Лимит обращений к ИИ на сегодня исчерпан.' }),
    );

    render(<SubmissionAiReview homeworkId={5} studentProfileId={7} />);

    expect(screen.getByText(/Лимит обращений к ИИ/)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('идущая задача видна на кнопке', () => {
    useAiGradeSuggestion.mockReturnValue(ai({ isRunning: true }));

    render(<SubmissionAiReview homeworkId={5} studentProfileId={7} />);

    expect(screen.getByRole('button', { name: /Проверяю работу/ })).toBeDisabled();
  });

  it('фото-работа: учитель правит распознавание, оценку и комментарий до передачи в проверку', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    useAiGradeSuggestion.mockReturnValue(ai({
      recommendation: {
        basis: 'COMPLETENESS', percent: 80, score: 80, maxScore: 100,
        summary: 'Большая часть выполнена.', issues: ['Нет единиц измерения'],
        recognizedText: 'Страница 1: F = ma', uncertainFragments: ['Страница 1: показатель степени'],
        strengths: ['Верно записана формула'], suggestedGrade: 8,
        suggestedComment: 'Добавьте единицы измерения.',
      },
    }));

    render(<SubmissionAiReview homeworkId={5} studentProfileId={7} attemptId={9}
      photoCount={2} onConfirm={onConfirm} />);

    expect(screen.getByRole('button', { name: 'Проверить с AI' })).toBeInTheDocument();
    expect(screen.getByText(/показатель степени/)).toBeInTheDocument();
    expect(screen.getByText(/Верно записана формула/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Текст и формулы по порядку страниц'));
    await user.type(screen.getByLabelText('Текст и формулы по порядку страниц'), 'Страница 1: F = m a');
    await user.clear(screen.getByLabelText('Оценка 1–10'));
    await user.type(screen.getByLabelText('Оценка 1–10'), '7');
    await user.clear(screen.getByLabelText('Комментарий ученику'));
    await user.type(screen.getByLabelText('Комментарий ученику'), 'Проверьте формулу.');
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Передать в проверку ДЗ' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({
      recognizedText: 'Страница 1: F = m a', grade: 7, comment: 'Проверьте формулу.',
    }));
    expect(confirmPhotoReview).toHaveBeenCalledWith(5, 7, {
      expectedAttemptId: 9,
      recognizedText: 'Страница 1: F = m a', grade: 7, comment: 'Проверьте формулу.',
    });
  });

  it('не передаёт черновик в обычную проверку, если сервер не сохранил его', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    confirmPhotoReview.mockRejectedValue(new Error('network'));
    useAiGradeSuggestion.mockReturnValue(ai({ recommendation: {
      basis: 'COMPLETENESS', percent: 80, summary: 'Проверка',
      recognizedText: 'Страница 1', suggestedGrade: 8,
    } }));

    render(<SubmissionAiReview homeworkId={5} studentProfileId={7} attemptId={9}
      photoCount={1} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Передать в проверку ДЗ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить AI-черновик');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('после повторного открытия восстанавливает подтверждённый черновик Teacher', async () => {
    const onConfirm = vi.fn();
    useAiGradeSuggestion.mockReturnValue(ai({ recommendation: {
      basis: 'COMPLETENESS', recognizedText: 'AI-текст', suggestedGrade: 8,
      suggestedComment: 'AI-комментарий',
      teacherRecognizedText: 'Исправленный текст', teacherGrade: 7,
      teacherComment: 'Исправленный комментарий', teacherConfirmedAt: '2026-10-08T10:00:00Z',
    } }));

    render(<SubmissionAiReview homeworkId={5} studentProfileId={7} attemptId={9}
      photoCount={1} onConfirm={onConfirm} />);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({
      recognizedText: 'Исправленный текст', grade: 7,
      comment: 'Исправленный комментарий',
    }, true));
    expect(screen.getByLabelText('Текст и формулы по порядку страниц')).toHaveValue('Исправленный текст');
    expect(screen.getByLabelText('Оценка 1–10')).toHaveValue(7);
  });
});
