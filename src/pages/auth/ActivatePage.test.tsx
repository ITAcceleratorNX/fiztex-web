import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { ActivatePage } from './ActivatePage';

const auth = vi.hoisted(() => ({ activate: vi.fn() }));

vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));

const PHONE = '+77000000000';
const CODE = 'TEST-CODE';
const PASSWORD = 'test-password-1';

function renderPage() {
  return render(
    <MemoryRouter>
      <ActivatePage />
    </MemoryRouter>,
  );
}

async function fill(password = PASSWORD, repeat = password) {
  await userEvent.type(screen.getByLabelText('Телефон или email'), PHONE);
  await userEvent.type(screen.getByLabelText('Код активации'), CODE);
  await userEvent.type(screen.getByLabelText('Новый пароль'), password);
  await userEvent.type(screen.getByLabelText('Повторите пароль'), repeat);
}

const submitButton = () => screen.getByRole('button', { name: 'Активировать и войти' });

describe('ActivatePage', () => {
  beforeEach(() => {
    auth.activate.mockReset();
  });

  it('кнопка закрыта, пока пароль короче восьми символов', async () => {
    renderPage();
    await fill('short');
    expect(submitButton()).toBeDisabled();
  });

  it('кнопка закрыта, пока пароли не совпали', async () => {
    renderPage();
    await fill(PASSWORD, 'another-password');
    expect(submitButton()).toBeDisabled();
  });

  it('отправляет телефон, код и пароль', async () => {
    auth.activate.mockResolvedValue({ role: 'TEACHER' });
    renderPage();
    await fill();
    await userEvent.click(submitButton());
    expect(auth.activate).toHaveBeenCalledWith(PHONE, CODE, PASSWORD);
  });

  it('на отказ 400 не уточняет, что именно не подошло', async () => {
    auth.activate.mockRejectedValue(new ApiError(400, 'Код активации неверный или уже использован'));
    renderPage();
    await fill();
    await userEvent.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Код неверный или уже использован');
  });

  it('обрыв связи не выдаёт за неверный код', async () => {
    auth.activate.mockRejectedValue(new ApiError(0, 'Нет соединения'));
    renderPage();
    await fill();
    await userEvent.click(submitButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Проверьте соединение');
    expect(alert).not.toHaveTextContent('Код неверный');
  });
});
