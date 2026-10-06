import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassFormModal } from './ClassFormModal';

const hooks = vi.hoisted(() => ({
  teachers: vi.fn(),
  create: vi.fn(),
  retry: vi.fn(),
}));

vi.mock('@/hooks/queries', () => ({
  useAdminHomeroomTeachers: hooks.teachers,
  useCreateSchoolClass: () => ({ mutateAsync: hooks.create }),
}));
vi.mock('../services', () => ({ updateClass: vi.fn() }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const years = [{
  id: '1', name: '2026–2027', startDate: '2026-09-01', endDate: '2027-05-31',
  status: 'ACTIVE' as const, createdAt: '',
}];

function show() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<ClassFormModal open onClose={onClose} years={years} onSaved={onSaved} />);
  return { onClose, onSaved };
}

beforeEach(() => {
  hooks.create.mockReset();
  hooks.retry.mockReset();
  hooks.teachers.mockReset();
});

describe('ClassFormModal', () => {
  it('allows creation without a teacher when the directory is empty', async () => {
    hooks.teachers.mockReturnValue({ isPending: false, isError: false, isSuccess: true, data: [] });
    hooks.create.mockResolvedValue({ id: 1 });
    const user = userEvent.setup();
    const { onSaved, onClose } = show();

    expect(screen.getByText('Учителя не найдены')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Классный руководитель' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: /Название класса/ }), '5А');
    await user.click(screen.getByRole('button', { name: 'Создать', exact: true }));

    await waitFor(() => expect(hooks.create).toHaveBeenCalledWith(expect.objectContaining({
      academicYearId: 1, name: '5А', homeroomTeacherProfileId: undefined,
    })));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('offers retry after teacher loading fails while keeping the form usable', async () => {
    hooks.teachers.mockReturnValue({
      isPending: false, isError: true, isSuccess: false, data: undefined,
      refetch: hooks.retry,
    });
    const user = userEvent.setup();
    show();

    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить учителей.');
    expect(screen.getByRole('button', { name: 'Классный руководитель' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Создать', exact: true })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(hooks.retry).toHaveBeenCalledOnce();
  });

  it('submits the selected teacher in the same create request', async () => {
    hooks.teachers.mockReturnValue({
      isPending: false, isError: false, isSuccess: true,
      data: [{ id: 7, firstName: 'Айжан', lastName: 'Асанова' }],
    });
    hooks.create.mockResolvedValue({ id: 2 });
    const user = userEvent.setup();
    show();

    await user.type(screen.getByRole('textbox', { name: /Название класса/ }), '7Ә');
    await user.click(screen.getByRole('button', { name: 'Классный руководитель' }));
    await user.click(screen.getByRole('option', { name: 'Асанова Айжан' }));
    await user.click(screen.getByRole('button', { name: 'Создать', exact: true }));

    await waitFor(() => expect(hooks.create).toHaveBeenCalledWith(expect.objectContaining({
      academicYearId: 1, name: '7Ә', homeroomTeacherProfileId: 7,
    })));
  });
});
