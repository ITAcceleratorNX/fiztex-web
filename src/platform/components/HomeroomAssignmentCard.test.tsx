import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { HomeroomAssignmentCard } from './HomeroomAssignmentCard';

const mocks = vi.hoisted(() => ({
  current: vi.fn(), history: vi.fn(), teachers: vi.fn(),
  put: vi.fn(), remove: vi.fn(), currentRefetch: vi.fn(), historyRefetch: vi.fn(),
  teachersRefetch: vi.fn(), nextPage: vi.fn(), success: vi.fn(),
}));

vi.mock('@/hooks/queries', () => ({
  useAdminHomeroomCurrent: mocks.current,
  useAdminHomeroomHistory: mocks.history,
  useAdminHomeroomTeachers: mocks.teachers,
  usePutAdminHomeroom: () => ({ mutateAsync: mocks.put, isPending: false }),
  useRemoveAdminHomeroom: () => ({ mutateAsync: mocks.remove, isPending: false }),
}));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: mocks.success, error: vi.fn() }),
}));

const active = {
  classId: 4, className: '5А', classStatus: 'ACTIVE' as const,
  academicYearStatus: 'ACTIVE' as const, accessState: 'ACTIVE' as const,
  expectedCurrentAssignmentId: 17,
  assignment: { id: 17, teacherProfileId: 2, teacherName: 'Иванова Мария', startedAt: '2026-09-01T08:00:00Z' },
};

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.currentRefetch.mockResolvedValue({ data: active });
  mocks.historyRefetch.mockResolvedValue({});
  mocks.current.mockReturnValue({ data: active, isPending: false, isError: false, refetch: mocks.currentRefetch });
  mocks.history.mockReturnValue({
    data: { pages: [{ items: [active.assignment], hasMore: false }] },
    isPending: false, isError: false, hasNextPage: false,
    isFetchNextPageError: false, isFetchingNextPage: false,
    refetch: mocks.historyRefetch, fetchNextPage: mocks.nextPage,
  });
  mocks.teachers.mockReturnValue({
    data: [
      { id: 2, lastName: 'Иванова', firstName: 'Мария' },
      { id: 3, lastName: 'Петров', firstName: 'Иван' },
    ],
    isPending: false, isError: false, isSuccess: true, refetch: mocks.teachersRefetch,
  });
  mocks.put.mockResolvedValue(active);
  mocks.remove.mockResolvedValue(active);
});

describe('HomeroomAssignmentCard', () => {
  it('shows empty slot and history with assignment action', () => {
    mocks.current.mockReturnValue({
      data: { ...active, accessState: 'NO_ASSIGNMENT', expectedCurrentAssignmentId: null, assignment: undefined },
      isPending: false, isError: false, refetch: mocks.currentRefetch,
    });
    mocks.history.mockReturnValue({
      data: { pages: [{ items: [], hasMore: false }] }, isPending: false, isError: false,
      hasNextPage: false, refetch: mocks.historyRefetch,
    });
    render(<HomeroomAssignmentCard classId={4} />);
    expect(screen.getByText('Классный руководитель не назначен')).toBeInTheDocument();
    expect(screen.getByText('История назначений пока пуста')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Назначить' })).toBeEnabled();
  });

  it('sends an explicit null version when assigning to an empty slot', async () => {
    mocks.current.mockReturnValue({
      data: { ...active, accessState: 'NO_ASSIGNMENT', expectedCurrentAssignmentId: null, assignment: undefined },
      isPending: false, isError: false, refetch: mocks.currentRefetch,
    });
    const user = userEvent.setup();
    render(<HomeroomAssignmentCard classId={4} />);
    await user.click(screen.getByRole('button', { name: 'Назначить' }));
    await user.click(screen.getByRole('button', { name: 'Классный руководитель' }));
    await user.click(screen.getByRole('option', { name: 'Петров Иван' }));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith({
      teacherProfileId: 3, expectedCurrentAssignmentId: null,
    }));
  });

  it('replaces using the version read from the server', async () => {
    const user = userEvent.setup();
    render(<HomeroomAssignmentCard classId={4} />);
    await user.click(screen.getByRole('button', { name: 'Заменить' }));
    await user.click(screen.getByRole('button', { name: 'Классный руководитель' }));
    await user.click(screen.getByRole('option', { name: 'Петров Иван' }));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith({
      teacherProfileId: 3, expectedCurrentAssignmentId: 17,
    }));
    expect(mocks.success).toHaveBeenCalledWith('Классный руководитель заменён');
  });

  it('confirms removal and sends the current assignment ID', async () => {
    const user = userEvent.setup();
    render(<HomeroomAssignmentCard classId={4} />);
    await user.click(screen.getByRole('button', { name: 'Снять' }));
    expect(screen.getByText(/потеряет доступ/)).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Снять' }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith({ expectedCurrentAssignmentId: 17 }));
  });

  it('refreshes the slot and history after a stale version instead of retrying blindly', async () => {
    mocks.put.mockRejectedValue(new ApiError(409, 'changed', 'HOMEROOM_ASSIGNMENT_CHANGED'));
    const user = userEvent.setup();
    render(<HomeroomAssignmentCard classId={4} />);
    await user.click(screen.getByRole('button', { name: 'Заменить' }));
    await user.click(screen.getByRole('button', { name: 'Классный руководитель' }));
    await user.click(screen.getByRole('option', { name: 'Петров Иван' }));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(mocks.currentRefetch).toHaveBeenCalledOnce());
    expect(mocks.historyRefetch).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Назначение уже изменилось/)).toBeInTheDocument();
    expect(mocks.put).toHaveBeenCalledTimes(1);
  });

  it('refreshes unavailable teachers and slot before another choice', async () => {
    mocks.put.mockRejectedValue(new ApiError(409, 'conflict', 'HOMEROOM_ASSIGNMENT_CONFLICT'));
    const user = userEvent.setup();
    render(<HomeroomAssignmentCard classId={4} />);
    await user.click(screen.getByRole('button', { name: 'Заменить' }));
    await user.click(screen.getByRole('button', { name: 'Классный руководитель' }));
    await user.click(screen.getByRole('option', { name: 'Петров Иван' }));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(mocks.teachersRefetch).toHaveBeenCalledOnce());
    expect(mocks.currentRefetch).toHaveBeenCalledOnce();
    expect(screen.getByText(/больше недоступны/)).toBeInTheDocument();
  });

  it('allows retry when the current assignment fails to load', async () => {
    mocks.current.mockReturnValue({ isPending: false, isError: true, refetch: mocks.currentRefetch });
    const user = userEvent.setup();
    render(<HomeroomAssignmentCard classId={4} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить назначение.');
    expect(screen.queryByRole('button', { name: 'Заменить' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(mocks.currentRefetch).toHaveBeenCalledOnce();
  });

  it('offers a retry for history errors and paginates long histories', async () => {
    mocks.history.mockReturnValue({
      data: undefined, isPending: false, isError: true, hasNextPage: false,
      refetch: mocks.historyRefetch,
    });
    const user = userEvent.setup();
    const view = render(<HomeroomAssignmentCard classId={4} />);
    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(mocks.historyRefetch).toHaveBeenCalledOnce();

    mocks.history.mockReturnValue({
      data: { pages: [{ items: [active.assignment], hasMore: true }] },
      isPending: false, isError: false, hasNextPage: true,
      isFetchNextPageError: false, isFetchingNextPage: false,
      refetch: mocks.historyRefetch, fetchNextPage: mocks.nextPage,
    });
    view.rerender(<HomeroomAssignmentCard classId={4} />);
    await user.click(screen.getByRole('button', { name: 'Показать ещё' }));
    expect(mocks.nextPage).toHaveBeenCalledOnce();
  });
});
