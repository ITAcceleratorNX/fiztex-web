import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '@/components/ui/Modal';
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

  it('dismisses errors automatically and exposes a large named close control', () => {
    vi.useFakeTimers();
    renderToastControls();
    fireEvent.click(screen.getByRole('button', { name: 'Ошибка' }));

    act(() => vi.advanceTimersByTime(14_999));
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось сохранить длинное сообщение');
    const close = screen.getByRole('button', { name: 'Закрыть сообщение об ошибке' });
    expect(close).toHaveClass('size-11');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ошибка' }));
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть сообщение об ошибке' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('expires the last notification after StrictMode replays its timer effect', () => {
    vi.useFakeTimers();
    render(<StrictMode><ToastProvider><ToastControls /></ToastProvider></StrictMode>);
    fireEvent.click(screen.getByRole('button', { name: 'Успех' }));
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps independent deadlines when another toast is added or dismissed', () => {
    vi.useFakeTimers();
    renderToastControls();
    fireEvent.click(screen.getByRole('button', { name: 'Успех' }));
    act(() => vi.advanceTimersByTime(5_000));
    fireEvent.click(screen.getByRole('button', { name: 'Подсказка' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ошибка' }));
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть сообщение об ошибке' }));
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.queryByText('Изменения сохранены')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Подсказка');
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('waits until both hover and keyboard focus leave before resuming', () => {
    vi.useFakeTimers();
    renderToastControls();
    fireEvent.click(screen.getByRole('button', { name: 'Успех' }));
    const close = screen.getByRole('button', { name: 'Закрыть уведомление' });
    const item = close.parentElement!;
    act(() => vi.advanceTimersByTime(4_000));
    fireEvent.mouseEnter(item);
    act(() => close.focus());
    fireEvent.mouseLeave(item);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => close.blur());
    act(() => vi.advanceTimersByTime(6_000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('dismisses a toast above nested modals without closing them or activating the page', async () => {
    const user = userEvent.setup();
    function Flow() {
      const toast = useToast();
      const [childOpen, setChildOpen] = useState(false);
      return <>
        <button type="button">Фоновое действие</button>
        <Modal open onClose={vi.fn()} title="Основное окно">
          <button type="button" onClick={() => setChildOpen(true)}>Открыть вложенное окно</button>
        </Modal>
        <Modal open={childOpen} onClose={() => setChildOpen(false)} title="Вложенное окно">
          <button type="button" onClick={() => toast.error('Ошибка поверх окна')}>Показать ошибку</button>
        </Modal>
      </>;
    }
    render(<ToastProvider><Flow /></ToastProvider>);
    await user.click(screen.getByRole('button', { name: 'Открыть вложенное окно' }));
    await user.click(screen.getByRole('button', { name: 'Показать ошибку' }));
    const close = screen.getByRole('button', { name: 'Закрыть сообщение об ошибке' });
    expect(close.closest('[inert]')).toBeNull();
    close.focus();
    expect(close).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('dialog', { name: 'Вложенное окно' })).toContainElement(document.activeElement as HTMLElement);
    await user.tab({ shift: true });
    expect(close).toHaveFocus();
    await user.click(close);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Вложенное окно' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('dialog', { name: 'Основное окно' })).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'Фоновое действие' })).toHaveAttribute('inert');
    await user.tab();
    expect(screen.getByRole('dialog', { name: 'Вложенное окно' })).toContainElement(document.activeElement as HTMLElement);
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
