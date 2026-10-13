import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceAiApplyModal } from './WorkspaceAiApplyModal';

function renderChoice(currentQuestionCount: number, busy = false, empty = false) {
  const props = {
    currentQuestionCount, busy, onApply: vi.fn(), onClose: vi.fn(),
    job: { id: 19, result: { questions: empty ? [] : [{ type: 'OPEN_TEXT' as const, text: 'Новый вопрос', maxScore: 1 }] } },
  };
  render(<WorkspaceAiApplyModal {...props} />);
  return props;
}

describe('WorkspaceAiApplyModal', () => {
  it('позволяет добавить ровно до 50 вопросов и сохраняет выбор замены', async () => {
    const props = renderChoice(49);
    expect(screen.getByText(/Всего будет 50 вопросов/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Добавить к текущим' }));
    expect(props.onApply).toHaveBeenLastCalledWith('APPEND');
    await userEvent.click(screen.getByRole('button', { name: 'Заменить вопросы' }));
    expect(props.onApply).toHaveBeenLastCalledWith('REPLACE');
  });

  it('блокирует превышение лимита, но позволяет заменить набор или оставить черновик', async () => {
    const props = renderChoice(50);
    expect(screen.getByRole('button', { name: 'Добавить к текущим' })).toBeDisabled();
    expect(screen.getByText(/В одном тесте может быть до 50 вопросов/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Заменить вопросы' }));
    expect(props.onApply).toHaveBeenCalledWith('REPLACE');
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it.each([{ busy: true, empty: false }, { busy: false, empty: true }])('не применяет пустой набор или изменения при сохранении: %j', ({ busy, empty }) => {
    renderChoice(2, busy, empty);
    expect(screen.getByRole('button', { name: 'Добавить к текущим' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Заменить вопросы' })).toBeDisabled();
  });
});
