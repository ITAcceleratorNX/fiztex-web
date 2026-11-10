import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateRangePicker } from './DateRangePicker';

afterEach(() => vi.useRealTimers());

describe('DateRangePicker', () => {
  it('disables past and occupied dates, marks today and explains the calendar colors', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 5, 12));
    render(<DateRangePicker value={{ from: '', to: '' }} onChange={vi.fn()} occupiedRanges={[{ from: '2026-11-18', to: '2026-11-18' }]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Выберите день или период' }));

    expect(screen.getByRole('button', { name: /4 ноября 2026 г\., прошедшая дата/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /18 ноября 2026 г\., дата уже занята/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '5 ноября 2026 г.' })).toBeEnabled();
    expect(screen.getByText('Сегодня')).toBeInTheDocument();
    expect(screen.getByText('Занято другой заявкой')).toBeInTheDocument();
  });

  it('shows selected period in navy and the range interior in a pale blue', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 5, 12));
    const onChange = vi.fn();
    const { rerender } = render(<DateRangePicker value={{ from: '', to: '' }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Выберите день или период' }));
    fireEvent.click(screen.getByRole('button', { name: '9 ноября 2026 г.' }));
    rerender(<DateRangePicker value={{ from: '2026-11-09', to: '2026-11-09' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '11 ноября 2026 г.' }));
    rerender(<DateRangePicker value={{ from: '2026-11-09', to: '2026-11-11' }} onChange={onChange} />);

    expect(screen.getByRole('button', { name: '9 ноября 2026 г.' })).toHaveClass('bg-navy-700');
    expect(screen.getByRole('button', { name: '10 ноября 2026 г.' })).toHaveClass('bg-indigo-50');
    expect(screen.getByRole('button', { name: '11 ноября 2026 г.' })).toHaveClass('bg-navy-700');
  });
});
