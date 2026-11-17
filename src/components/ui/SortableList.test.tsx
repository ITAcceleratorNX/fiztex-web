import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SortableList } from './SortableList';
import { FilterChip } from './FilterChip';
import { AiProgressPanel } from './AiProgressPanel';

function Harness() {
  const [items, setItems] = useState(['Начало', 'Середина', 'Конец']);
  return (
    <SortableList
      items={items}
      getKey={(item) => item}
      itemLabel={(index) => `Этап ${index + 1}`}
      onMove={(from, to) => setItems((list) => {
        const next = list.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      })}
      renderItem={({ item, handle }) => <div data-testid="row">{handle}<span data-testid="name">{item}</span></div>}
    />
  );
}

const order = () => screen.getAllByTestId('name').map((name) => name.textContent);

describe('SortableList', () => {
  it('moves a row with arrow keys and keeps focus on its handle', () => {
    render(<Harness />);
    const handle = screen.getByRole('button', { name: /Этап 1/ });
    handle.focus();
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(order()).toEqual(['Середина', 'Начало', 'Конец']);
    expect(document.activeElement?.closest('[data-testid="row"]')?.querySelector('[data-testid="name"]')?.textContent)
      .toBe('Начало');
    expect(screen.getByText('Этап 1: теперь 2 из 3')).toBeInTheDocument();
  });

  it('does not move past the edges', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('button', { name: /Этап 1/ }), { key: 'ArrowUp' });
    expect(order()).toEqual(['Начало', 'Середина', 'Конец']);
  });

  it('drops a dragged row where the line shows', () => {
    render(<Harness />);
    const rows = screen.getAllByTestId('row').map((row) => row.parentElement as HTMLElement);
    const dataTransfer = { setData: () => undefined, effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(screen.getByRole('button', { name: /Этап 1/ }), { dataTransfer });
    // jsdom отдаёт нулевые прямоугольники — курсор «ниже середины» последней строки.
    fireEvent.dragOver(rows[2], { dataTransfer, clientY: 10 });
    fireEvent.drop(rows[2], { dataTransfer });
    expect(order()).toEqual(['Середина', 'Конец', 'Начало']);
  });
});

describe('FilterChip check', () => {
  it('shows the check only when selected and reports pressed state', () => {
    const { rerender } = render(<FilterChip appearance="check" label="Рефлексия" selected={false} onClick={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Рефлексия' })).toHaveAttribute('aria-pressed', 'false');
    rerender(<FilterChip appearance="check" label="Рефлексия" selected onClick={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Рефлексия' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('AiProgressPanel', () => {
  it('is a status while running and an alert on error', () => {
    const { rerender } = render(<AiProgressPanel title="ИИ составляет КСП…" description="Окно можно закрыть" />);
    expect(screen.getByRole('status')).toHaveTextContent('ИИ составляет КСП…');
    rerender(<AiProgressPanel state="error" title="КСП не сгенерирован" description="Нет связи" />);
    expect(screen.getByRole('alert')).toHaveTextContent('КСП не сгенерированНет связи');
  });
});
