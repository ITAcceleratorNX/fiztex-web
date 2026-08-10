import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiVariantModal } from './AiVariantModal';
import { useAiQuestionVariant } from '@/hooks/queries';
import { emptyQuestion, type QuestionDraft } from '@/lib/testQuestions';
import type { AiQuestionVariantResponse } from '@/lib/types';

vi.mock('@/hooks/queries', () => ({
  useAiQuestionVariant: vi.fn(),
}));

const original: QuestionDraft = {
  ...emptyQuestion('SINGLE_CHOICE'),
  text: 'Чему равно значение выражения 2³ · 2²?',
  options: [
    { localId: 'a', text: '2⁵', isCorrect: true },
    { localId: 'b', text: '2⁶', isCorrect: false },
  ],
};

const response: AiQuestionVariantResponse = {
  question: {
    type: 'SINGLE_CHOICE',
    text: 'Чему равно значение выражения 3⁴ · 3²?',
    maxScore: 1,
    options: [
      { text: '3⁶', isCorrect: true, orderIndex: 0 },
      { text: '3⁸', isCorrect: false, orderIndex: 1 },
    ],
  },
  solution: 'Показатели складываются: 3⁴⁺² = 3⁶',
  model: 'gemini-2.5-flash',
  inputTokens: 351,
  outputTokens: 207,
};

/**
 * isPending мутации здесь намеренно оставлен true: запрос уходит из эффекта, и в StrictMode
 * наблюдатель пересоздаётся — ответ приходит, а isPending так и остаётся true. Окно обязано
 * ориентироваться на собственное состояние, иначе залипает на спиннере навсегда.
 */
function mockHook(mutateAsync: () => Promise<AiQuestionVariantResponse>) {
  vi.mocked(useAiQuestionVariant).mockReturnValue({
    mutateAsync,
    isPending: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

describe('AiVariantModal', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('показывает вариант, ход вычисления и предупреждение', async () => {
    mockHook(() => Promise.resolve(response));

    render(<AiVariantModal open onClose={vi.fn()} original={original} onAdd={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('Чему равно значение выражения 3⁴ · 3²?')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Создаём вариант…')).not.toBeInTheDocument();
    expect(screen.getByText('Чему равно значение выражения 2³ · 2²?')).toBeInTheDocument();
    expect(screen.getByText('Показатели складываются: 3⁴⁺² = 3⁶')).toBeInTheDocument();
    expect(
      screen.getByText(/Проверьте пересчитанный ответ/),
    ).toBeInTheDocument();
  });

  it('отдаёт вариант наверх только по подтверждению', async () => {
    const onAdd = vi.fn();
    mockHook(() => Promise.resolve(response));

    render(<AiVariantModal open onClose={vi.fn()} original={original} onAdd={onAdd} />);
    await waitFor(() =>
      expect(screen.getByText('Чему равно значение выражения 3⁴ · 3²?')).toBeInTheDocument(),
    );

    expect(onAdd).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Добавить в тест/ }));

    expect(onAdd).toHaveBeenCalledWith(response.question);
  });

  it('показывает ошибку вместо спиннера, если AI не справился', async () => {
    mockHook(() => Promise.reject(new Error('boom')));

    render(<AiVariantModal open onClose={vi.fn()} original={original} onAdd={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('Не удалось создать вариант')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Создаём вариант…')).not.toBeInTheDocument();
  });
});
