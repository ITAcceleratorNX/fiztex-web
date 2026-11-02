import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GradePicker } from './GradePicker';
import { placePanel } from './AnchoredPanel';

const scale = ['2', '3', '4', '5'].map((code, index) => ({ code, sortOrder: index }));

describe('placePanel', () => {
  it('keeps the old placement when there is room: under the anchor, right edges aligned', () => {
    expect(placePanel({ top: 100, bottom: 132, right: 900 }, { width: 230, height: 200 }, { width: 1280, height: 800 }))
      .toEqual({ top: 140, left: 670, maxWidth: 1264 });
  });

  it('never leaves the window on the left in a 365 px viewport (QA-04)', () => {
    const placed = placePanel({ top: 300, bottom: 332, right: 120 }, { width: 230, height: 200 }, { width: 365, height: 700 });
    expect(placed.left).toBe(8);
    expect(placed.left + 230).toBeLessThanOrEqual(365 - 8);
  });

  it('opens above the anchor when there is no room below, and scrolls when there is none at all', () => {
    expect(placePanel({ top: 500, bottom: 532, right: 300 }, { width: 230, height: 300 }, { width: 365, height: 600 }).top)
      .toBe(192);
    expect(placePanel({ top: 100, bottom: 132, right: 300 }, { width: 230, height: 900 }, { width: 365, height: 600 }))
      .toMatchObject({ top: 8, maxHeight: 584 });
  });

  it('shrinks a panel wider than the window to fit inside the margins', () => {
    expect(placePanel({ top: 0, bottom: 10, right: 200 }, { width: 400, height: 100 }, { width: 300, height: 600 }))
      .toMatchObject({ left: 8, maxWidth: 284 });
  });
});

describe('grade picker in a panel', () => {
  it('renders above the page in body, not inside the clipped cell, and focuses the current value', () => {
    render(
      <div data-testid="cell" style={{ overflow: 'hidden' }}>
        <button type="button">4</button>
        <GradePicker scale={scale} value="4" onPick={() => undefined} onTypeChange={() => undefined} onClose={() => undefined} />
      </div>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Выбор оценки' });
    expect(screen.getByTestId('cell')).not.toContainElement(dialog);
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveClass('z-[60]');
    expect(dialog).toHaveStyle({ position: 'fixed' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '4', pressed: true }));
  });

  it('can be used from the keyboard: Escape closes and returns focus to the cell', () => {
    let open = true;
    const { rerender } = render(
      <div>
        <button type="button">ячейка</button>
        {open && <GradePicker scale={scale} onPick={() => undefined} onTypeChange={() => undefined} onClose={() => { open = false; }} />}
      </div>,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '2' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    rerender(
      <div>
        <button type="button">ячейка</button>
        {open && <GradePicker scale={scale} onPick={() => undefined} onTypeChange={() => undefined} onClose={() => { open = false; }} />}
      </div>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'ячейка' }));
  });
});
