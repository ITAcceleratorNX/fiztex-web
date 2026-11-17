import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import { cx } from '@/lib/format';
import { Tooltip } from './Tooltip';

/**
 * Список с перестановкой строк (Figma `КСП / Этап — редактор` 2212:8042, пояснение 2212:9603):
 * тянут за ⠿ слева. Пока строку тянут, на старом месте она бледнеет, рядом с курсором — сама
 * строка (изображение перетаскивания), оранжевая линия показывает, куда она встанет.
 *
 * С клавиатуры: фокус на ⠿, стрелки вверх и вниз; фокус едет вместе со строкой, а новое
 * место объявляется скринридеру. Перетаскивание — родное HTML5: библиотека ради одного
 * вертикального списка в зависимостях не появилась.
 *
 * Список ничего не хранит: порядок — у вызывающего, сюда приходят `items` и `onMove`.
 */
export function SortableList<T>({
  items,
  getKey,
  onMove,
  itemLabel,
  renderItem,
  className,
}: {
  items: T[];
  getKey: (item: T) => string;
  onMove: (from: number, to: number) => void;
  /** Имя строки для скринридера: «Этап 2». */
  itemLabel: (index: number) => string;
  renderItem: (args: { item: T; index: number; handle: ReactElement; dragging: boolean }) => ReactNode;
  className?: string;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const focusKey = useRef<string | null>(null);

  // Строка переехала с клавиатуры — фокус едет за ней, а не остаётся на чужой ⠿.
  useEffect(() => {
    if (focusKey.current == null) return;
    handles.current.get(focusKey.current)?.focus();
    focusKey.current = null;
  }, [items]);

  const reset = () => {
    setDragIndex(null);
    setInsertAt(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number, key: string) => {
    const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    focusKey.current = key;
    onMove(index, target);
    setAnnouncement(`${itemLabel(index)}: теперь ${target + 1} из ${items.length}`);
  };

  const onDragStart = (event: DragEvent<HTMLButtonElement>, index: number, key: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
    // Под курсором — вся строка, а не значок: так видно, какой этап едет.
    const row = event.currentTarget.closest<HTMLElement>('[data-sortable-row]');
    if (row && typeof event.dataTransfer.setDragImage === 'function') {
      const rect = row.getBoundingClientRect();
      event.dataTransfer.setDragImage(row, event.clientX - rect.left, event.clientY - rect.top);
    }
    setDragIndex(index);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    if (dragIndex == null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    setInsertAt(event.clientY < rect.top + rect.height / 2 ? index : index + 1);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (dragIndex == null || insertAt == null) return reset();
    event.preventDefault();
    const target = insertAt > dragIndex ? insertAt - 1 : insertAt;
    if (target !== dragIndex) onMove(dragIndex, target);
    reset();
  };

  // Линия там, где строка встанет, и не там, где она уже стоит.
  const lineAt = insertAt != null && dragIndex != null && insertAt !== dragIndex && insertAt !== dragIndex + 1
    ? insertAt
    : null;

  return (
    <div className={className}>
      {items.map((item, index) => {
        const key = getKey(item);
        const dragging = dragIndex === index;
        const handle = (
          <Tooltip label="Перетащите, чтобы изменить порядок">
            <button
              type="button"
              ref={(node) => {
                if (node) handles.current.set(key, node);
                else handles.current.delete(key);
              }}
              draggable
              aria-label={`Переставить: ${itemLabel(index)}. Стрелки вверх и вниз`}
              onDragStart={(event) => onDragStart(event, index, key)}
              onDragEnd={reset}
              onKeyDown={(event) => onKeyDown(event, index, key)}
              className="flex size-7 cursor-grab items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-navy-700 focus-visible:bg-slate-100 focus-visible:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-300 active:cursor-grabbing"
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
        );
        return (
          <div
            key={key}
            data-sortable-row=""
            onDragOver={(event) => onDragOver(event, index)}
            onDrop={onDrop}
            className={cx('relative', dragging && 'opacity-40')}
          >
            {lineAt === index && <DropLine position="top" />}
            {renderItem({ item, index, handle, dragging })}
            {lineAt === items.length && index === items.length - 1 && <DropLine position="bottom" />}
          </div>
        );
      })}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </div>
  );
}

function DropLine({ position }: { position: 'top' | 'bottom' }) {
  return (
    <span
      aria-hidden="true"
      className={cx('pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-brand-500', position === 'top' ? '-top-px' : '-bottom-px')}
    />
  );
}
