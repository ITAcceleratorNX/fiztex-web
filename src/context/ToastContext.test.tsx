import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './ToastContext';

function ToastControls() {
  const toast = useToast();
  return (
    <div>
      <button type="button" onClick={() => toast.success('Изменения сохранены')}>Успех</button>
      <button type="button" onClick={() => toast.info('Подсказка')}>Подсказка</button>
      <button type="button" onClick={() => toast.error('Не удалось сохранить длинное сообщение')}>Ошибка</button>
      <button
        type="button"
        onClick={() => toast.success(Array.from({ length: 50 }, (_, index) => `слово${index}`).join(' '))}
      >
        Длинное сообщение
      </button>
    </div>
  );
}

function renderToastControls() {
  return render(
    <ToastProvider>
      <ToastControls />
    </ToastProvider>,
  );
}

describe('ToastProvider announcements', () => {
  afterEach(() => vi.useRealTimers());

  it('announces one message at a time with polite status and urgent error semantics', () => {
    renderToastControls();

    fireEvent.click(screen.getByRole('button', { name: 'Успех' }));
    fireEvent.click(screen.getByRole('button', { name: 'Подсказка' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ошибка' }));

    const statuses = screen.getAllByRole('status');
    expect(statuses).toHaveLength(2);
    expect(statuses[0]).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByRole('alert')).toHaveAttribute('aria-atomic', 'true');
    expect(statuses[0]).toHaveTextContent('Изменения сохранены');
    expect(statuses[1]).toHaveTextContent('Подсказка');
  });

  it('keeps errors until dismissed and exposes a large named close control', () => {
    vi.useFakeTimers();
    renderToastControls();
    fireEvent.click(screen.getByRole('button', { name: 'Ошибка' }));

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось сохранить длинное сообщение');

    const close = screen.getByRole('button', { name: 'Закрыть сообщение об ошибке' });
    expect(close).toHaveClass('size-11');
    fireEvent.click(close);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('gives long success messages more reading time and pauses while keyboard focus is inside', () => {
    vi.useFakeTimers();
    renderToastControls();
    const trigger = screen.getByRole('button', { name: 'Длинное сообщение' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(trigger);

    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByRole('status')).toBeInTheDocument();

    const close = screen.getByRole('button', { name: 'Закрыть уведомление' });
    close.focus();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('status')).toBeInTheDocument();

    close.blur();
    act(() => vi.advanceTimersByTime(7_499));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
