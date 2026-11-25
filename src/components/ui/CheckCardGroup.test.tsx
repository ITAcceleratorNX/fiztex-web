import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CheckCardGroup } from './CheckCardGroup';
import { Field } from './Field';

const options = [
  { value: 'GRADES', title: 'Оценки', description: 'Журнал, СОР/СОЧ и итоговые оценки' },
  { value: 'ATTENDANCE', title: 'Посещаемость', description: 'Отметки и пропуски по урокам' },
  { value: 'ANALYTICS', title: 'Учебная аналитика' },
] as const;

describe('CheckCardGroup', () => {
  it('отмечает выбранные и отдаёт значения в порядке вариантов, а не нажатий', async () => {
    const onChange = vi.fn();
    render(<CheckCardGroup ariaLabel="Разделы" options={options} values={['ANALYTICS']} onChange={onChange} />);

    expect(screen.getByRole('checkbox', { name: /Учебная аналитика/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: /Оценки/ })).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(screen.getByRole('checkbox', { name: /Оценки/ }));
    expect(onChange).toHaveBeenLastCalledWith(['GRADES', 'ANALYTICS']);
  });

  it('снимает отметку повторным нажатием', async () => {
    const onChange = vi.fn();
    render(<CheckCardGroup ariaLabel="Разделы" options={options} values={['GRADES', 'ATTENDANCE']} onChange={onChange} />);

    await userEvent.click(screen.getByRole('checkbox', { name: /Оценки/ }));
    expect(onChange).toHaveBeenLastCalledWith(['ATTENDANCE']);
  });

  it('берёт подпись и ошибку у Field и красит невыбранные карточки', () => {
    render(
      <Field label="Разделы" error="Выберите хотя бы один раздел">
        <CheckCardGroup ariaLabel="Разделы" options={options} values={[]} onChange={() => {}} />
      </Field>,
    );

    const group = screen.getByRole('group', { name: 'Разделы' });
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAccessibleDescription('Выберите хотя бы один раздел');
    expect(screen.getByRole('checkbox', { name: /Посещаемость/ }).className).toContain('border-red-300');
  });

  it('выключенная группа не меняет выбор', async () => {
    const onChange = vi.fn();
    render(<CheckCardGroup ariaLabel="Разделы" options={options} values={[]} onChange={onChange} disabled />);

    await userEvent.click(screen.getByRole('checkbox', { name: /Оценки/ }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
