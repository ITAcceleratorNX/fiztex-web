import { StrictMode, useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';
import { Select } from './Select';

function BasicModal({ onClose = vi.fn() }: { onClose?: () => void }) {
  return (
    <>
      <button type="button">Background action</button>
      <Modal open onClose={onClose} title="Редактировать профиль" subtitle="Укажите имя">
        <input aria-label="Имя" />
        <button type="button">Первое действие</button>
        <button type="button">Последнее действие</button>
      </Modal>
    </>
  );
}

describe('Modal accessibility', () => {
  it('names the dialog and close button, describes it, and moves focus inside', () => {
    render(<BasicModal />);

    const dialog = screen.getByRole('dialog', { name: 'Редактировать профиль' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-describedby');
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)).toHaveTextContent('Укажите имя');
    expect(within(dialog).getByRole('button', { name: 'Закрыть окно' })).toBeInTheDocument();
    expect(document.activeElement).toBe(within(dialog).getByRole('textbox', { name: 'Имя' }));
  });

  it('traps Tab at both ends and redirects programmatic focus away from the background', () => {
    render(<BasicModal />);
    const dialog = screen.getByRole('dialog', { name: 'Редактировать профиль' });
    const first = within(dialog).getByRole('button', { name: 'Закрыть окно' });
    const last = within(dialog).getByRole('button', { name: 'Последнее действие' });
    const background = screen.getByRole('button', { name: 'Background action' });

    expect(background).toHaveAttribute('inert');
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Закрыть окно' }));

    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    background.focus();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('locks page scrolling while open and restores the previous body style on close', () => {
    document.body.style.overflow = 'auto';
    const { unmount } = render(<BasicModal />);

    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });

  it('restores focus to the opener when the dialog closes', async () => {
    const user = userEvent.setup();
    function Flow() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Диалог">
            <button type="button">Внутреннее действие</button>
          </Modal>
        </>
      );
    }

    render(<Flow />);
    const opener = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(opener);
    await user.keyboard('{Escape}');

    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('keeps the original opener when StrictMode replays layout effects', async () => {
    const user = userEvent.setup();
    function Flow() {
      const [open, setOpen] = useState(true);
      return (
        <Modal open={open} onClose={() => setOpen(false)} title="Strict dialog">
          <button type="button">Внутреннее действие</button>
        </Modal>
      );
    }

    const opener = document.createElement('button');
    opener.textContent = 'External opener';
    document.body.append(opener);
    opener.focus();
    render(<StrictMode><Flow /></StrictMode>);
    await user.keyboard('{Escape}');

    await waitFor(() => expect(document.activeElement).toBe(opener));
    opener.remove();
  });

  it('returns focus to the new page heading if navigation removes the opener', async () => {
    const user = userEvent.setup();
    function Flow() {
      const [page, setPage] = useState(false);
      const [open, setOpen] = useState(false);
      return page ? (
        <main><h1>Карточка профиля</h1></main>
      ) : (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
          <Modal
            open={open}
            onClose={() => {
              setOpen(false);
              setPage(true);
            }}
            title="Профиль"
          >
            <button type="button">Внутреннее действие</button>
          </Modal>
        </>
      );
    }

    render(<Flow />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.keyboard('{Escape}');

    const heading = await screen.findByRole('heading', { name: 'Карточка профиля' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('keeps right drawer header actions and nested planning dialog focus independent', async () => {
    const user = userEvent.setup();
    function NestedFlow() {
      const [parentOpen, setParentOpen] = useState(false);
      const [childOpen, setChildOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setParentOpen(true)}>Open parent</button>
          <Modal open={parentOpen} onClose={() => setParentOpen(false)} title="Родительский диалог" placement="right"
            headerActions={<button type="button" onClick={() => setChildOpen(true)}>Open child</button>}>
            <p>Данные ученика</p>
          </Modal>
          <Modal open={childOpen} onClose={() => setChildOpen(false)} title="Вложенный диалог" appearance="planning-wide" size="planning" scrollable>
            <button type="button">Действие вложенного окна</button>
          </Modal>
        </>
      );
    }

    render(<NestedFlow />);
    await user.click(screen.getByRole('button', { name: 'Open parent' }));
    const parent = screen.getByRole('dialog', { name: 'Родительский диалог' });
    const childOpener = within(parent).getByRole('button', { name: 'Open child' });
    await user.click(childOpener);

    const child = screen.getByRole('dialog', { name: 'Вложенный диалог' });
    expect(child).toHaveAttribute('aria-modal', 'true');
    expect(parent).toHaveAttribute('aria-modal', 'false');
    expect(parent).toHaveAttribute('inert');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Вложенный диалог' })).not.toBeInTheDocument());
    expect(parent).toHaveAttribute('aria-modal', 'true');
    expect(document.activeElement).toBe(childOpener);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Родительский диалог' })).not.toBeInTheDocument());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open parent' }));
  });

  it('lets an open Select consume Escape before the dialog does', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Выбор группы">
        <Select value="a" onChange={() => undefined}>
          <option value="a">Группа А</option>
          <option value="b">Группа Б</option>
        </Select>
      </Modal>,
    );

    const trigger = screen.getByRole('button', { name: 'Группа А' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('dialog', { name: 'Выбор группы' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// Боковая шторка уезжает за край перед закрытием (заметка дизайнера к кадру T1 — «страница
// должна плавно открываться»). В jsdom нет `matchMedia`, поэтому остальные тесты закрывают окно
// сразу; здесь «система не просит меньше движения» задаётся явно.
describe('Modal right drawer motion', () => {
  function motion(allowed: boolean) {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: allowed && query === '(prefers-reduced-motion: no-preference)',
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    return () => { window.matchMedia = original; };
  }

  // В jsdom нет `AnimationEvent`, и React слушает префиксное `webkitAnimationEnd` вместо
  // `animationend`. Отправляем оба — в браузере сработает одно из них.
  function endAnimation(element: Element) {
    fireEvent.animationEnd(element);
    fireEvent(element, new Event('webkitAnimationEnd', { bubbles: true }));
  }

  function Drawer({ onClose }: { onClose: () => void }) {
    return (
      <Modal open onClose={onClose} title="Шторка ученика" placement="right">
        <p data-testid="drawer-content" className="animate-fade-in">Данные ученика</p>
      </Modal>
    );
  }

  it('slides in and slides out before calling onClose', () => {
    const restore = motion(true);
    try {
      const onClose = vi.fn();
      render(<Drawer onClose={onClose} />);
      const dialog = screen.getByRole('dialog', { name: 'Шторка ученика' });
      expect(dialog).toHaveClass('animate-drawer-in');

      // Конец въезда и анимации содержимого окно не закрывают.
      endAnimation(dialog);
      endAnimation(screen.getByTestId('drawer-content'));
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть окно' }));
      expect(dialog).toHaveClass('animate-drawer-out');
      expect(onClose).not.toHaveBeenCalled();

      // Второе нажатие во время ухода не закрывает дважды.
      fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть окно' }));
      endAnimation(dialog);
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });

  it('leaves by Escape too and closes even without the end of the animation', () => {
    const restore = motion(true);
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      render(<Drawer onClose={onClose} />);
      const dialog = screen.getByRole('dialog', { name: 'Шторка ученика' });

      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(dialog).toHaveClass('animate-drawer-out');
      expect(onClose).not.toHaveBeenCalled();

      // Вкладка в фоне: `animationend` не пришёл — запасной таймер всё равно закрывает.
      act(() => { vi.advanceTimersByTime(400); });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      restore();
    }
  });

  it('closes at once when the system asks for less motion', () => {
    const restore = motion(false);
    try {
      const onClose = vi.fn();
      render(<Drawer onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: 'Закрыть окно' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });

  it('starts over with a fresh slide-in after the parent reopens it', () => {
    const restore = motion(true);
    try {
      function Toggle() {
        const [open, setOpen] = useState(true);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>Открыть снова</button>
            <Modal open={open} onClose={() => setOpen(false)} title="Шторка ученика" placement="right">
              <p>Данные ученика</p>
            </Modal>
          </>
        );
      }
      render(<Toggle />);
      const dialog = screen.getByRole('dialog', { name: 'Шторка ученика' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть окно' }));
      endAnimation(dialog);
      expect(screen.queryByRole('dialog', { name: 'Шторка ученика' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Открыть снова' }));
      expect(screen.getByRole('dialog', { name: 'Шторка ученика' })).toHaveClass('animate-drawer-in');
    } finally {
      restore();
    }
  });
});
