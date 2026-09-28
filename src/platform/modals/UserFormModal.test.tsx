import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserFormModal } from './UserFormModal';

const services = vi.hoisted(() => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('../services', () => services);
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

describe('UserFormModal accessibility', () => {
  it('associates the required name error and focuses that field without clearing it', async () => {
    const user = userEvent.setup();
    render(<UserFormModal open onClose={vi.fn()} user={null} onSaved={vi.fn()} />);

    const name = screen.getByLabelText('ФИО');
    await user.click(screen.getByRole('button', { name: 'Создать' }));

    expect(name).toHaveFocus();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    const descriptionIds = name.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(descriptionIds.map((id) => document.getElementById(id)?.textContent).join(' '))
      .toContain('Укажите ФИО');
    expect(services.createUser).not.toHaveBeenCalled();
  });
});
