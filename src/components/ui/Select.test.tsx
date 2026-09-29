import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Select } from './Select';

function SelectHarness() {
  const [value, setValue] = useState('5a');
  return (
    <>
      <Select aria-label="Класс" value={value} onChange={(event) => setValue(event.target.value)}>
        <option value="5a">5А</option>
        <option value="5b" disabled>5Б</option>
        <option value="6b">6Б</option>
        <option value="math">Математика</option>
        <option value="music">Музыка</option>
      </Select>
      <output data-testid="selected-value">{value}</output>
      <button type="button">Следующее поле</button>
    </>
  );
}

describe('Select keyboard interaction', () => {
  it('opens with Enter, skips disabled options with arrows, and commits only on Enter', async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);

    const trigger = screen.getByRole('button', { name: 'Класс' });
    trigger.focus();
    await user.keyboard('{Enter}');

    const fiveA = screen.getByRole('option', { name: '5А' });
    expect(document.activeElement).toBe(fiveA);
    expect(fiveA).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    const sixB = screen.getByRole('option', { name: '6Б' });
    expect(document.activeElement).toBe(sixB);
    expect(sixB).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('option', { name: '5Б' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('selected-value')).toHaveTextContent('5a');

    await user.keyboard('{Enter}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByTestId('selected-value')).toHaveTextContent('6b');
    expect(document.activeElement).toBe(trigger);
  });

  it('opens with Space and Escape closes without changing the selection or focus', async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);

    const trigger = screen.getByRole('button', { name: 'Класс' });
    trigger.focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByTestId('selected-value')).toHaveTextContent('5a');
    expect(document.activeElement).toBe(trigger);
  });

  it('supports Home, End, and type-ahead search', async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);

    const trigger = screen.getByRole('button', { name: 'Класс' });
    await user.click(trigger);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('option', { name: 'Музыка' }));

    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(screen.getByRole('option', { name: '5А' }));

    await user.keyboard('ма');
    expect(document.activeElement).toBe(screen.getByRole('option', { name: 'Математика' }));
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('selected-value')).toHaveTextContent('math');
  });

  it('closes when Tab moves focus out of the open list', async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);

    await user.click(screen.getByRole('button', { name: 'Класс' }));
    await user.tab();

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Следующее поле' }));
  });
});
