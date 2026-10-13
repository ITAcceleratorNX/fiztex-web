import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { ParentCommentDialog } from './ParentCommentDialog';

const mocks = vi.hoisted(() => ({ publish: vi.fn(), improve: vi.fn() }));
vi.mock('@/hooks/queries', () => ({
  usePublishParentComment: () => ({ mutateAsync: mocks.publish, isPending: false }),
  useImproveParentComment: () => ({ mutateAsync: mocks.improve, isPending: false }),
}));
const original = 'Не выполнил домашнее задание';
const props = { lessonId: 1, row: { studentProfileId: 2, fullName: 'Нурай Галымжан', canEdit: true },
  subjectName: 'Английский язык', date: '2026-10-14', onClose: vi.fn(), onReload: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); });

describe('parent comment publication', () => {
  it('keeps AI as an editable preview until the teacher explicitly publishes', async () => {
    const user = userEvent.setup();
    mocks.improve.mockResolvedValue({ text: 'Ребёнок не выполнил домашнее задание.' });
    mocks.publish.mockImplementation(async body => ({ id: 4, ...body, version: 0 }));
    render(<ParentCommentDialog {...props} />);
    expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeDisabled();
    await user.type(screen.getByRole('textbox'), original);
    await user.click(screen.getByRole('button', { name: 'Улучшить с AI' }));
    expect(mocks.improve).toHaveBeenCalledWith({ studentId: 2, text: original });
    expect(mocks.publish).not.toHaveBeenCalled();
    await user.type(screen.getByRole('textbox'), ' Обсудим на встрече.');
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    expect(mocks.publish).toHaveBeenCalledWith({ studentId: 2, text: 'Ребёнок не выполнил домашнее задание. Обсудим на встрече.', version: undefined });
    expect(await screen.findByRole('button', { name: 'Редактировать' })).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('can restore the original and leaves it intact after AI errors', async () => {
    const user = userEvent.setup();
    mocks.improve.mockResolvedValueOnce({ text: 'AI-вариант' }).mockRejectedValueOnce(new Error('offline'));
    render(<ParentCommentDialog {...props} />);
    await user.type(screen.getByRole('textbox'), original);
    await user.click(screen.getByRole('button', { name: 'Улучшить с AI' }));
    await user.click(screen.getByRole('button', { name: 'Вернуть мой текст' }));
    expect(screen.getByRole('textbox')).toHaveValue(original);
    await user.click(screen.getByRole('button', { name: 'Улучшить с AI' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось улучшить текст');
    expect(screen.getByRole('textbox')).toHaveValue(original);
  });
  it('shows the published version and prevents overwriting a concurrent edit', async () => {
    const user = userEvent.setup();
    mocks.publish.mockRejectedValue(new ApiError(409, 'Комментарий уже изменён'));
    render(<ParentCommentDialog {...props} row={{ ...props.row, comment: { id: 4, text: original, version: 3 } }} />);
    await user.click(screen.getByRole('button', { name: 'Редактировать' }));
    await user.type(screen.getByRole('textbox'), '. Новый текст.');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(mocks.publish.mock.calls[0][0].version).toBe(3);
    expect(await screen.findByRole('alert')).toHaveTextContent('Комментарий уже изменён');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    expect(screen.getByRole('textbox')).toHaveValue(`${original}. Новый текст.`);
  });
  it('requires a deliberate choice before discarding an unfinished comment', async () => {
    const user = userEvent.setup();
    render(<ParentCommentDialog {...props} />);
    await user.type(screen.getByRole('textbox'), original);
    await user.click(screen.getByRole('button', { name: 'Закрыть окно' }));
    expect(screen.getByText('Закрыть без сохранения?')).toBeVisible();
    expect(props.onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Продолжить редактирование' }));
    expect(screen.getByRole('textbox')).toHaveValue(original);
  });
});
