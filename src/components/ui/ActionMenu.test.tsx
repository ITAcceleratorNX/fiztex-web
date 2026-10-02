import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActionMenu } from './ActionMenu';

describe('ActionMenu', () => {
  it('выполняет выбранное действие и закрывается по Escape', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ActionMenu label="Действия с материалом" items={[{ label: 'Переименовать', onSelect }]} />);
    const trigger = screen.getByRole('button', { name: 'Действия с материалом' });

    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Переименовать' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Переименовать' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Переименовать' }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Переименовать' })).not.toBeInTheDocument();
  });
});
