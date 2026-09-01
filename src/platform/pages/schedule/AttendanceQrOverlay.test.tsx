import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceQrOverlay } from './AttendanceQrOverlay';

function renderOverlay(overrides: Partial<Parameters<typeof AttendanceQrOverlay>[0]> = {}) {
  const onClose = vi.fn();
  const onReissue = vi.fn();
  render(
    <AttendanceQrOverlay
      payload="fiztex:att:1:token-1"
      lessonTitle="Физика · 10 «А» · 10:00–10:45"
      lessonEndsAt={null}
      busy={false}
      onReissue={onReissue}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onClose, onReissue };
}

describe('AttendanceQrOverlay', () => {
  it('все три выхода делают одно и то же — гасят код', async () => {
    const user = userEvent.setup();
    const { onClose } = renderOverlay();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Закрыть QR-код' }));
    await user.click(screen.getByRole('button', { name: 'Закрыть' }));

    // Ровно та причина, по которой отвергнут вариант «свернуть, не закрывая»: учитель
    // не должен помнить, какой из выходов выключает код в классе.
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('рисует код ровно тем, что прислал бэкенд', () => {
    renderOverlay();

    // Разбирать payload клиенту нечего: формат принадлежит серверу и однажды сменится.
    const qr = screen.getByRole('img', { name: 'QR-код для отметки посещаемости' });
    expect(qr).toBeInTheDocument();
    expect(qr.tagName.toLowerCase()).toBe('svg');
  });

  it('пока кода нет, показывает место под него, а не пустой квадрат', () => {
    renderOverlay({ payload: null });

    expect(screen.queryByRole('img', { name: /QR-код/ })).not.toBeInTheDocument();
    expect(screen.getByText('Отсканируйте код в приложении PhysTech')).toBeInTheDocument();
  });

  it('фокус уходит на «Закрыть»: у полноэкранного кода один ожидаемый выход', () => {
    renderOverlay();

    expect(screen.getByRole('button', { name: 'Закрыть' })).toHaveFocus();
  });

  it('в момент звонка закрывается сам — мёртвый код классу не показывают', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      render(
        <AttendanceQrOverlay
          payload="fiztex:att:1:token-1"
          lessonTitle="Физика"
          lessonEndsAt={new Date(Date.now() + 60_000).toISOString()}
          busy={false}
          onReissue={vi.fn()}
          onClose={onClose}
        />,
      );

      expect(onClose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(60_000);
      // Это не таймер на экране (ТЗ §7 его исключает), а отказ врать учителю.
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
