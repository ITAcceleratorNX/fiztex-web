import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubjectsTab } from './SubjectsTab';
import { useSubjects, useUpdateSubject } from '@/hooks/queries';
import type { Subject } from '@/lib/types';

vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; to: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/hooks/queries', () => ({
  useSubjects: vi.fn(),
  useUpdateSubject: vi.fn(),
  useCreateSubject: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const activeSubject: Subject = {
  id: 1,
  name: 'Математика',
  description: null,
  status: 'ACTIVE',
  testCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
};

const hiddenSubject: Subject = {
  id: 2,
  name: 'Физика',
  description: null,
  status: 'HIDDEN',
  testCount: 0,
  createdAt: '2026-01-02T00:00:00Z',
};

function mockSubjects(data: Subject[]) {
  vi.mocked(useSubjects).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useSubjects>);
}

function mockUpdateMutation(mutateAsync: ReturnType<typeof vi.fn>) {
  vi.mocked(useUpdateSubject).mockReturnValue({
    isPending: false,
    mutateAsync,
  } as unknown as ReturnType<typeof useUpdateSubject>);
}

describe('SubjectsTab', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMutation(vi.fn());
  });

  it('does not render delete action', () => {
    mockSubjects([activeSubject]);
    render(<SubjectsTab />);

    expect(screen.queryByTitle('Удалить предмет')).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Нельзя удалить/)).not.toBeInTheDocument();
  });

  it('hides subject, filters hidden list, and reactivates', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ ...activeSubject, status: 'HIDDEN' });
    mockUpdateMutation(mutateAsync);
    mockSubjects([activeSubject, hiddenSubject]);

    render(<SubjectsTab />);

    await user.click(screen.getByTitle('Скрыть'));

    const hideDialog = within(screen.getByRole('dialog'));
    expect(hideDialog.getByText(/исчезнет из выбора для новых тестов/i)).toBeInTheDocument();
    expect(hideDialog.getByText(/существующие тесты, попытки и результаты сохранятся/i)).toBeInTheDocument();

    await user.click(hideDialog.getByRole('button', { name: 'Скрыть' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      id: activeSubject.id,
      body: {
        name: activeSubject.name,
        description: activeSubject.description,
        status: 'HIDDEN',
      },
    });

    const statusFilter = screen.getByRole('button', { name: /Статус: Все/i });
    await user.click(statusFilter);
    await user.click(screen.getByRole('option', { name: 'Скрыт' }));
    expect(screen.getByText('Физика')).toBeInTheDocument();
    expect(screen.queryByText('Математика')).not.toBeInTheDocument();

    await user.click(screen.getByTitle('Активировать'));

    expect(mutateAsync).toHaveBeenLastCalledWith({
      id: hiddenSubject.id,
      body: {
        name: hiddenSubject.name,
        description: hiddenSubject.description,
        status: 'ACTIVE',
      },
    });
  });
});
