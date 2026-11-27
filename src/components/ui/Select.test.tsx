import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

describe('Select option labels', () => {
  it('joins mixed option children without commas', async () => {
    const label = 'Класс';
    render(
      <Select aria-label={label} value="" onChange={() => {}}>
        <option value="">{label}: все</option>
        <option value="7">7А</option>
      </Select>,
    );

    const trigger = screen.getByRole('button', { name: label });
    expect(trigger).toHaveTextContent('Класс: все');
    expect(trigger).not.toHaveTextContent('Класс,: все');

    await userEvent.click(trigger);
    expect(screen.getByRole('option', { name: 'Класс: все' })).toBeInTheDocument();
  });
});

describe('Select: группы и подпись справа', () => {
  it('рисует заголовки групп и подпись пункта, выбор идёт по пунктам подряд', async () => {
    const { SelectGroup } = await import('./Select');
    const onChange = vi.fn();
    render(
      <Select aria-label="Класс" value="1" onChange={(event) => onChange(event.target.value)}>
        <SelectGroup label="Мои классы">
          <option value="1">5А</option>
        </SelectGroup>
        <SelectGroup label="Только просмотр">
          <option value="2" data-hint="до 31.05.2027">8А</option>
        </SelectGroup>
      </Select>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Класс' }));
    expect(screen.getByText('Мои классы')).toBeInTheDocument();
    expect(screen.getByText('Только просмотр')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /8А/ })).toHaveTextContent('до 31.05.2027');

    await userEvent.click(screen.getByRole('option', { name: /8А/ }));
    expect(onChange).toHaveBeenCalledWith('2');
  });
});
