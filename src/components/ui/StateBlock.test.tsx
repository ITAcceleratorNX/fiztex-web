import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBlock, LoadingBlock } from './StateBlock';

describe('StateBlock accessibility', () => {
  it('announces loading politely and exposes retry outside the alert message', () => {
    const onRetry = vi.fn();
    render(
      <>
        <LoadingBlock label="Загружаем список…" />
        <ErrorBlock message="Не удалось загрузить список" onRetry={onRetry} />
      </>,
    );

    const status = screen.getByRole('status');
    const alert = screen.getByRole('alert');
    const retry = screen.getByRole('button', { name: 'Повторить' });

    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(status).toHaveTextContent('Загружаем список…');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent('Не удалось загрузить список');
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument();

    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
