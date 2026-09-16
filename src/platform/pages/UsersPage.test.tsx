import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { UsersPage } from './UsersPage';

/**
 * Служебные роли в общей таблице: один пункт меню и один чип фильтра на все четыре.
 *
 * Проверяется то, чего нет у остальных ролей, — склейка: `/admin/accounts` принимает
 * одну роль за раз, поэтому порядок строк и страницы у этого чипа клиентские.
 */

const listUsersPage = vi.fn();
const listAccountsByRoles = vi.fn();

vi.mock('@/platform/services', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/platform/services');
  return {
    ...actual,
    listUsersPage: (...args: unknown[]) => listUsersPage(...args),
    listAccountsByRoles: (...args: unknown[]) => listAccountsByRoles(...args),
  };
});

vi.mock('@/platform/hooks/useUserStats', () => ({
  useUserStats: () => ({ data: undefined }),
  useInvalidateUserStats: () => () => Promise.resolve(),
}));

function account(id: number, fullName: string, role: string) {
  return {
    id: String(id),
    fullName,
    role,
    email: null,
    phone: '+77001234567',
    status: 'ACTIVE',
    relationLabel: null,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/admin/users']}>
          <UsersPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('UsersPage — внутренние сотрудники', () => {
  it('меню создания предлагает «Сотрудник», а не одну охрану', async () => {
    listUsersPage.mockResolvedValue({ users: [], totalElements: 0, totalPages: 0 });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /Добавить пользователя/ }));

    expect(screen.getByRole('menuitem', { name: /Сотрудник/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Охрана/ })).toBeNull();
  });

  it('чип «Сотрудники» собирает все служебные роли одним списком по алфавиту', async () => {
    listUsersPage.mockResolvedValue({ users: [], totalElements: 0, totalPages: 0 });
    listAccountsByRoles.mockResolvedValue([
      account(2, 'Ярова Анна', 'SECURITY'),
      account(1, 'Абаев Бек', 'CLEANING'),
    ]);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Сотрудники' }));

    await waitFor(() => expect(listAccountsByRoles).toHaveBeenCalled());
    expect(listAccountsByRoles.mock.calls[0][0]).toEqual([
      'CLEANING',
      'TECHNICIAN',
      'SECURITY',
      'PSYCHOLOGIST',
    ]);

    await screen.findByText('Абаев Бек');
    const names = screen.getAllByText(/Абаев Бек|Ярова Анна/).map((node) => node.textContent);
    expect(names).toEqual(['Абаев Бек', 'Ярова Анна']);
    expect(screen.getByText(/1–2 из 2/)).toBeTruthy();
  });
});
