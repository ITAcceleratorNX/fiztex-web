import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundRoute } from './NotFoundPage';

const auth = vi.hoisted(() => ({
  current: {
    admin: null as { role: string } | null,
    isAuthenticated: false,
  },
}));

vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth.current }));
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="authenticated-layout">{children}</div>
  ),
}));

function renderUnknownPage(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/previous" element={<p>Предыдущая страница</p>} />
        <Route path="/dashboard" element={<p>Главная администратора</p>} />
        <Route path="/homework" element={<p>Домашние задания</p>} />
        <Route path="/psychologist/tests" element={<p>Тесты психолога</p>} />
        <Route path="/psychologist/tests" element={<p>Тесты психолога</p>} />
        <Route path="/" element={<p>Публичная главная</p>} />
        <Route path="/staff/login" element={<p>Вход в панель</p>} />
        <Route path="*" element={<NotFoundRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NotFoundRoute', () => {
  beforeEach(() => {
    auth.current = { admin: null, isAuthenticated: false };
  });

  it('гостю объясняет, что ссылка не найдена, и предлагает публичную главную и вход', () => {
    renderUnknownPage(['/ux-audit-missing-page']);

    expect(screen.getByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Перейти на публичную главную' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/staff/login');
    expect(screen.queryByTestId('authenticated-layout')).not.toBeInTheDocument();
  });

  it.each([
    ['ADMIN', '/dashboard', 'Главная администратора'],
    ['TEACHER', '/homework', 'Домашние задания'],
    ['PSYCHOLOGIST', '/psychologist/tests', 'Тесты психолога'],
  ])('для роли %s остаётся в панели и предлагает её главный раздел', (role, home, heading) => {
    auth.current = { admin: { role }, isAuthenticated: true };
    renderUnknownPage(['/ux-audit-missing-page']);

    expect(screen.getByTestId('authenticated-layout')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Перейти в свой раздел' })).toHaveAttribute('href', home);
    expect(screen.queryByRole('link', { name: 'Войти' })).not.toBeInTheDocument();
    expect(screen.getByText('Откроется раздел, подходящий для вашей роли.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Перейти в свой раздел' }));

    expect(screen.getByText(heading)).toBeInTheDocument();
  });

  it('кнопка «Назад» возвращает пользователя на предыдущую страницу', () => {
    renderUnknownPage(['/previous', '/ux-audit-missing-page']);

    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));

    expect(screen.getByText('Предыдущая страница')).toBeInTheDocument();
  });
});
