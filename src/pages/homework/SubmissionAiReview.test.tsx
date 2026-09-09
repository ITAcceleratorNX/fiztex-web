import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubmissionAiReview } from './SubmissionAiReview';

const useAiGradeSuggestion = vi.fn();

vi.mock('./useAiGradeSuggestion', () => ({
  useAiGradeSuggestion: (...args: unknown[]) => useAiGradeSuggestion(...args),
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
});
