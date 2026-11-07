import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnlinkRelationButton } from './UnlinkRelationButton';

const mocks = vi.hoisted(() => ({ unlink: vi.fn(), success: vi.fn(), error: vi.fn() }));

vi.mock('../services', () => ({ unlinkStudent: mocks.unlink }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));

const props = {
  parentProfileId: 59,
  studentProfileId: 14,
  parentName: 'Иванова Мария Александровна',
  studentName: 'Иванова Дана Маратовна',
};

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.unlink.mockResolvedValue(undefined);
});

describe('отвязка родителя от ученика', () => {
  it('спрашивает подтверждение и называет обоих', async () => {
    render(<UnlinkRelationButton side="student" {...props} onUnlinked={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /Отвязать родителя Иванова Мария/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Отвязать родителя?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Иванова Мария Александровна перестанет видеть');
    expect(dialog).toHaveTextContent('Иванова Дана Маратовна');
    // Связь архивируется, а не удаляется, — об этом сказано, иначе администратор побоится
    // нажать на обратимое действие.
    expect(dialog).toHaveTextContent('привязать обратно можно здесь же');
    expect(mocks.unlink).not.toHaveBeenCalled();
  });

  it('снимает связь и перечитывает карточку', async () => {
    const onUnlinked = vi.fn();
    render(<UnlinkRelationButton side="student" {...props} onUnlinked={onUnlinked} />);

    await userEvent.click(screen.getByRole('button', { name: /Отвязать родителя/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отвязать' }));

    await waitFor(() => expect(mocks.unlink).toHaveBeenCalledWith(59, 14));
    expect(mocks.success).toHaveBeenCalledWith('Родитель отвязан');
    expect(onUnlinked).toHaveBeenCalled();
  });

  it('с карточки родителя спрашивает про ученика', async () => {
    // Связь одна, экрана два: заголовок и подпись кнопки смотрят с той стороны, где стоит
    // администратор, а снимается одно и то же.
    render(<UnlinkRelationButton side="parent" {...props} onUnlinked={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /Отвязать ученика Иванова Дана/ }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('Отвязать ученика?')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отвязать' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Ученик отвязан'));
    expect(mocks.unlink).toHaveBeenCalledWith(59, 14);
  });

  it('на ошибке оставляет окно открытым', async () => {
    const onUnlinked = vi.fn();
    mocks.unlink.mockRejectedValue(new Error('сеть'));
    render(<UnlinkRelationButton side="student" {...props} onUnlinked={onUnlinked} />);

    await userEvent.click(screen.getByRole('button', { name: /Отвязать родителя/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отвязать' }));

    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(onUnlinked).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
