import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PeriodicTablePicker } from './PeriodicTablePicker';

describe('PeriodicTablePicker', () => {
  it('открывает полную периодическую таблицу и выбирает элемент из f-блока', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PeriodicTablePicker onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Таблица Менделеева' }));
    const table = within(screen.getByRole('table', { name: 'Периодическая таблица элементов' }));
    expect(table.getAllByRole('button')).toHaveLength(118);
    await user.click(table.getByRole('button', { name: 'Торий, Th, атомный номер 90' }));
    expect(onSelect).toHaveBeenCalledWith({ name: 'Торий', symbol: 'Th', atomicNumber: 90 });
    expect(screen.getByRole('status')).toHaveTextContent('Торий (Th)');
    await user.click(screen.getByRole('button', { name: 'Скрыть таблицу Менделеева' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('показывает понятные результаты поиска и позволяет восстановить таблицу', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PeriodicTablePicker onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Таблица Менделеева' }));
    const search = screen.getByRole('textbox', { name: 'Найти элемент' });
    await user.type(search, 'CO');
    await user.click(screen.getByRole('button', { name: 'Кобальт, Co, атомный номер 27' }));
    expect(onSelect).toHaveBeenCalledWith({ name: 'Кобальт', symbol: 'Co', atomicNumber: 27 });
    await user.clear(search); await user.type(search, 'не существует');
    expect(screen.getByText(/Элемент не найден/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Сбросить поиск' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
