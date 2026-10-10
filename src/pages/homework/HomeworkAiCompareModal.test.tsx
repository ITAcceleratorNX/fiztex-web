import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeworkAiCompareModal } from './HomeworkAiCompareModal';

const useHomeworkAiResult = vi.fn();
vi.mock('@/hooks/queries', () => ({
  useHomeworkAiResult: (...args: unknown[]) => useHomeworkAiResult(...args),
}));

function renderCompare(overrides: Partial<Parameters<typeof HomeworkAiCompareModal>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    homeworkId: 7,
    job: { id: 12, kind: 'TEST' as const },
    currentText: 'Текущее задание',
    currentQuestionCount: 3,
    busy: false,
    onApply: vi.fn(),
    onDiscard: vi.fn(),
    ...overrides,
  };
  render(<HomeworkAiCompareModal {...props} />);
  return props;
}

describe('HomeworkAiCompareModal', () => {
  beforeEach(() => {
    useHomeworkAiResult.mockReset();
    useHomeworkAiResult.mockReturnValue({
      data: { questions: [{ text: 'Новый вопрос', type: 'OPEN_TEXT', maxScore: 2 }] },
      isPending: false, isError: false, refetch: vi.fn(),
    });
  });

  it('предлагает добавить к текущему тесту либо явно заменить его', async () => {
    const user = userEvent.setup();
    const props = renderCompare();
    expect(screen.getByText(/Новые вопросы будут добавлены в конец теста/)).toHaveTextContent('Всего получится 4 вопроса.');
    await user.click(screen.getByRole('button', { name: 'Добавить к текущим' }));
    expect(props.onApply).toHaveBeenLastCalledWith('APPEND');
    await user.click(screen.getByRole('button', { name: 'Заменить текущие вопросы' }));
    expect(props.onApply).toHaveBeenLastCalledWith('REPLACE');
    await user.click(screen.getByRole('button', { name: 'Оставить текущий тест' }));
    expect(props.onDiscard).toHaveBeenCalledOnce();
    expect(props.onApply).toHaveBeenCalledTimes(2);
  });

  it('для пустого теста предлагает один способ добавить новый набор', async () => {
    const props = renderCompare({ currentQuestionCount: 0 });
    expect(screen.queryByRole('button', { name: 'Добавить к текущим' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Добавить вопросы' }));
    expect(props.onApply).toHaveBeenCalledWith('REPLACE');
  });

  it('объясняет превышение общего лимита и оставляет замену доступной', async () => {
    const props = renderCompare({ currentQuestionCount: 50 });
    expect(screen.getByText(/не более 50 вопросов/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить к текущим' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Заменить текущие вопросы' }));
    expect(props.onApply).toHaveBeenCalledWith('REPLACE');
  });

  it('разрешает добавление до ровно 50 вопросов', () => {
    renderCompare({ currentQuestionCount: 49 });
    expect(screen.getByRole('button', { name: 'Добавить к текущим' })).toBeEnabled();
  });

  it.each([
    { isPending: true, isError: false, data: undefined },
    { isPending: false, isError: true, data: undefined },
    { isPending: false, isError: false, data: { questions: [] } },
  ])('не применяет незагруженный, ошибочный или пустой результат: %j', (state) => {
    useHomeworkAiResult.mockReturnValue({ ...state, refetch: vi.fn() });
    renderCompare();
    expect(screen.getByRole('button', { name: 'Добавить к текущим' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Заменить текущие вопросы' })).toBeDisabled();
  });

  it('блокирует оба способа применения и отказ во время сохранения', () => {
    renderCompare({ busy: true, applyingMode: 'APPEND' });
    expect(screen.getByRole('button', { name: 'Добавить к текущим' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Заменить текущие вопросы' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Оставить текущий тест' })).toBeDisabled();
  });

  it('конспект сохраняет выбор текста без добавления вопросов', async () => {
    useHomeworkAiResult.mockReturnValue({
      data: { text: 'Новый текст' }, isPending: false, isError: false,
    });
    const props = renderCompare({ job: { id: 12, kind: 'MATERIAL' } });
    expect(screen.queryByRole('button', { name: 'Добавить к текущим' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Взять машинный текст' }));
    expect(props.onApply).toHaveBeenCalledWith('REPLACE');
  });
});
