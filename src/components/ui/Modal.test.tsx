import { StrictMode, useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('closes only the top modal on Escape and restores focus to its opener', async () => {
    const user = userEvent.setup();
    function NestedFlow() {
      const [parentOpen, setParentOpen] = useState(false);
      const [childOpen, setChildOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setParentOpen(true)}>Open parent</button>
          <Modal open={parentOpen} onClose={() => setParentOpen(false)} title="Родительский диалог">
            <button type="button" onClick={() => setChildOpen(true)}>Open child</button>
          </Modal>
          <Modal open={childOpen} onClose={() => setChildOpen(false)} title="Вложенный диалог">
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
