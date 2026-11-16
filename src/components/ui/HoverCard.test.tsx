import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HoverCard } from './HoverCard';

describe('HoverCard', () => {
  it('показывает карточку наведением и фокусом, прячет уходом и Escape', async () => {
    render(<HoverCard trigger={<span>i</span>} label="Причина статуса" title="Причина не аттестован">Работы не сданы</HoverCard>);
    const trigger = screen.getByRole('button', { name: 'Причина статуса' });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await userEvent.hover(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Причина не аттестованРаботы не сданы');
    await userEvent.unhover(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => trigger.focus());
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
