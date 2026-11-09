import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { MOBILE_ONLY_MESSAGE } from '@/lib/routes';
import { LoginPage } from './LoginPage';

const auth = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

async function submit() {
  await userEvent.type(screen.getByLabelText('Телефон или email'), '+77001000018');
  await userEvent.type(screen.getByLabelText('Пароль'), 'secret');
  await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
}

describe('LoginPage', () => {
  // Тело в фигурных скобках: функцию, которую вернёт beforeEach, Vitest вызывает как уборку
  // после теста, а `mockReset()` возвращает сам мок — он и вызывался бы, отдавая отказ.
  beforeEach(() => {
    auth.login.mockReset();
  });

  it('адресован сотрудникам и показывает ученикам и родителям их вход (пилот 1.2, 1.3)', () => {
    renderPage();

    expect(screen.getByText('Вход для сотрудников школы: учителей и администрации')).toBeInTheDocument();
    expect(screen.getByText('Ученикам и родителям — в мобильное приложение')).toBeInTheDocument();
    expect(screen.getByText(MOBILE_ONLY_MESSAGE)).toBeInTheDocument();
  });

  it('родителю с верными данными не говорит «неверный пароль» (пилот 5.1)', async () => {
    auth.login.mockRejectedValue(new ApiError(403, MOBILE_ONLY_MESSAGE, 'MOBILE_ONLY_ROLE'));
    renderPage();

    await submit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(MOBILE_ONLY_MESSAGE);
    expect(alert).not.toHaveTextContent(/неверный/i);
  });

  it('прочие отказы входа по-прежнему не уточняют, что не подошло', async () => {
    auth.login.mockRejectedValue(new ApiError(401, 'Bad credentials'));
    renderPage();

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный телефон или пароль');
  });
});
