import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MultiSelect, type MultiSelectOption } from './MultiSelect';

const CLASSES: MultiSelectOption[] = [
  { value: '1', label: '5А' },
  { value: '2', label: '5Б' },
  { value: '3', label: '6В' },
];

function Harness({ initial = [] as string[], options = CLASSES }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <MultiSelect aria-label="Класс(ы)" options={options} value={value} onChange={setValue} />
      <output data-testid="value">{value.join(',')}</output>
    </>
  );
}

describe('MultiSelect', () => {
  it('ставит и снимает галочки, показывая выбранное чипами в поле', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Класс(ы)' }));
    await user.click(screen.getByRole('option', { name: '6В' }));
    await user.click(screen.getByRole('option', { name: '5А' }));

    expect(screen.getByTestId('value')).toHaveTextContent('1,3');
    expect(screen.getByRole('option', { name: '5А' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('option', { name: '5А' }));
    expect(screen.getByTestId('value')).toHaveTextContent('3');
  });

  it('держит порядок вариантов, а не порядок нажатий', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['3']} />);

    await user.click(screen.getByRole('button', { name: 'Класс(ы)' }));
    await user.click(screen.getByRole('option', { name: '5Б' }));

    expect(screen.getByTestId('value')).toHaveTextContent('2,3');
  });

  it('Escape закрывает только список, а не окно, в котором он стоит', async () => {
    const user = userEvent.setup();
    const modalEscape = vi.fn();
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && modalEscape();
    document.addEventListener('keydown', onKeyDown);
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Класс(ы)' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(modalEscape).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onKeyDown);
  });

  it('говорит, что выбирать не из чего, вместо пустого меню', async () => {
    const user = userEvent.setup();
    render(<Harness options={[]} />);

    await user.click(screen.getByRole('button', { name: 'Класс(ы)' }));
    expect(screen.getByText('Нет вариантов')).toBeInTheDocument();
  });
});
