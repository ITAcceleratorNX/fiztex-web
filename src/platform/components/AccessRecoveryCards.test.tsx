import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParentAccessCard, StudentAccessCard } from './AccessRecoveryCards';

const reissueCode = vi.fn();
const resetPin = vi.fn();

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('../services', () => ({
  reissueCode: (...args: unknown[]) => reissueCode(...args),
  resetPin: (...args: unknown[]) => resetPin(...args),
  resetAccess: vi.fn(),
  issueTemporaryPassword: vi.fn(),
}));

describe('Вход и восстановление (Figma phyztex 2243:30309, 2243:30581)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reissueCode.mockResolvedValue({ issuedCode: 'AB12CD' });
  });

  it('ученик: сведения строками, действия и примечание', () => {
    render(<StudentAccessCard accountId={5} pinSet onChanged={() => {}} />);

    const facts = screen.getByText('Способ входа').closest('dl') as HTMLElement;
    expect(within(facts).getByText('Код и PIN')).toBeInTheDocument();
    expect(within(facts).getByText('Скрыт')).toBeInTheDocument();
    expect(within(facts).getByText('Создан')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Перевыпустить' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Сбросить PIN' })).toBeEnabled();
    expect(screen.getByText('Текущий PIN не показывается.')).toBeInTheDocument();
  });

  it('без PIN сбрасывать нечего', () => {
    render(<StudentAccessCard accountId={5} pinSet={false} onChanged={() => {}} />);

    expect(screen.getByText('Не создан')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сбросить PIN' })).toBeDisabled();
  });

  it('перевыпуск спрашивает подтверждение и показывает код один раз', async () => {
    const onChanged = vi.fn();
    render(<StudentAccessCard accountId={5} pinSet onChanged={onChanged} />);

    await userEvent.click(screen.getByRole('button', { name: 'Перевыпустить' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Перевыпустить' }));

    expect(reissueCode).toHaveBeenCalledWith('5');
    expect(await screen.findByText('AB12CD')).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it('родитель: пароль задан у активированного, две выдачи', () => {
    render(<ParentAccessCard accountId={7} accountStatus="ACTIVE" onChanged={() => {}} />);

    expect(screen.getByText('Телефон и пароль')).toBeInTheDocument();
    expect(screen.getByText('Задан')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Выдать код' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Выдать пароль' })).toBeInTheDocument();
    expect(screen.getByText('Текущий пароль не показывается. Выданный код или пароль покажется один раз.')).toBeInTheDocument();
  });

  it('у неактивированного родителя пароль не задан', () => {
    render(<ParentAccessCard accountId={7} accountStatus="NOT_ACTIVATED" onChanged={() => {}} />);

    expect(screen.getByText('Не задан')).toBeInTheDocument();
  });
});
