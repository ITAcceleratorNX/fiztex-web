import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateLessonPreparationModal } from './CreateLessonPreparationModal';

const create = vi.fn();
const success = vi.fn();

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success }) }));
vi.mock('@/hooks/queries', () => ({
  useCreateLessonPreparation: () => ({ mutateAsync: create, isPending: false }),
}));
vi.mock('@/components/workspace/WorkspaceMaterialPickerModal', () => ({
  WorkspaceMaterialPickerModal: ({ type, onConfirm, onClose }: {
    type?: string; onConfirm: (items: object[]) => void; onClose: () => void;
  }) => <button onClick={() => {
    onConfirm(type === 'TEXTBOOK'
      ? [{ id: 37, title: 'Физика 8 класс' }]
      : [{ id: 12, title: 'Лабораторная работа.pdf' }]);
    onClose();
  }}>Подтвердить {type === 'TEXTBOOK' ? 'учебник' : 'документ'}</button>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({ id: 7 });
});

describe('CreateLessonPreparationModal', () => {
  it('создаёт заготовку без урока с конспектом, документом и учебником', async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<CreateLessonPreparationModal onClose={onClose} onCreated={onCreated} />);
    const save = screen.getByRole('button', { name: 'Сохранить заготовку' });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Название заготовки' }), 'Курс механики');
    await userEvent.type(screen.getByRole('textbox', { name: 'Краткий конспект' }), 'Сила и масса');
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Тема урока' }), 'Закон Ньютона');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить из рабочего пространства' }));
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить документ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать учебник' }));
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить учебник' }));
    await userEvent.click(save);
    await waitFor(() => expect(create).toHaveBeenCalledWith({
      title: 'Курс механики', topic: 'Закон Ньютона',
      summary: { title: 'Закон Ньютона', summaryText: 'Сила и масса', companionText: '', companionKind: 'PLAN' },
      documentWorkspaceItemIds: [12], textbook: { workspaceItemId: 37 },
    }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onCreated).toHaveBeenCalledOnce();
    expect(success).toHaveBeenCalledWith('Заготовка сохранена. Её можно применить к нескольким урокам');
  });

  it('сохраняет заполненную форму после ошибки сервера', async () => {
    create.mockRejectedValue(new Error('network'));
    render(<CreateLessonPreparationModal onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Название заготовки' }), 'Механика');
    await userEvent.type(screen.getByRole('textbox', { name: 'Тема урока' }), 'Сила');
    await userEvent.type(screen.getByRole('textbox', { name: 'Краткий конспект' }), 'Определения');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить заготовку' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить заготовку');
    expect(screen.getByRole('textbox', { name: 'Краткий конспект' })).toHaveValue('Определения');
  });

  it('предупреждает перед закрытием несохранённого конспекта', async () => {
    const onClose = vi.fn();
    render(<CreateLessonPreparationModal onClose={onClose} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Название заготовки' }), 'Механика');
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.getByRole('heading', { name: 'Закрыть без сохранения?' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Не сохранять' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
