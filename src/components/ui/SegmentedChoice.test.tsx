import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedChoice } from './SegmentedChoice';

describe('SegmentedChoice', () => {
  const options = [
    { value: 'TEMP_UNATTESTED', label: 'ВНА', title: 'Временно не аттестован', tone: 'warning' as const },
    { value: 'NOT_ATTESTED', label: 'НА', title: 'Не аттестован', tone: 'danger' as const },
  ];

  it('отмечает выбранный вариант и зовёт выбор даже для него — решает экран', async () => {
    const onChoose = vi.fn();
    render(<SegmentedChoice ariaLabel="Аттестация" options={options} selected="TEMP_UNATTESTED" onChoose={onChoose} />);

    const temporary = screen.getByRole('button', { name: 'Временно не аттестован' });
    expect(temporary).toHaveAttribute('aria-pressed', 'true');
    expect(temporary.className).toContain('bg-amber-500');
    expect(screen.getByRole('button', { name: 'Не аттестован' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(temporary);
    await userEvent.click(screen.getByRole('button', { name: 'Не аттестован' }));
    expect(onChoose.mock.calls).toEqual([['TEMP_UNATTESTED'], ['NOT_ATTESTED']]);
  });

  it('без выбора ничего не отмечено, выключенный ряд не нажимается', async () => {
    const onChoose = vi.fn();
    render(<SegmentedChoice ariaLabel="Итог" options={[{ value: 4, label: '4' }]} selected={null} onChoose={onChoose} disabled />);

    const four = screen.getByRole('button', { name: '4' });
    expect(four).toHaveAttribute('aria-pressed', 'false');
    expect(four).toBeDisabled();
  });
});
