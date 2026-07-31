import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cx } from '@/lib/format';
import type { Subgroup } from '@/lib/schedule2bTypes';

export type StudentMenuAction =
  | { kind: 'move'; targetSubgroupId: number }
  | { kind: 'remove' }
  | { kind: 'add'; targetSubgroupId: number };

/**
 * Кнопка «→» в строке ученика (2015:12178) — 24px, radius 6, стрелка 12px.
 * Drag-n-drop в макете не показан, поэтому перенос сделан меню:
 * оно доступно с клавиатуры и работает при трёх и более группах.
 */
export function StudentActionMenu({
  studentLabel,
  subgroups,
  currentSubgroupId,
  mode,
  disabled,
  onAction,
}: {
  studentLabel: string;
  subgroups: Subgroup[];
  currentSubgroupId?: number | null;
  mode: 'member' | 'unassigned';
  disabled?: boolean;
  onAction: (action: StudentMenuAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const others = subgroups.filter((s) => s.id !== currentSubgroupId);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function choose(action: StudentMenuAction) {
    setOpen(false);
    onAction(action);
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-label={`Переместить: ${studentLabel}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cx(
          'flex size-6 items-center justify-center rounded-md text-gray-400 transition',
          'hover:bg-gray-100 hover:text-navy-700',
          'disabled:cursor-not-allowed disabled:opacity-40',
        )}
      >
        <ArrowRight className="size-3" />
      </button>

      {open && (
        <ul
          id={menuId}
          role="menu"
          className="absolute right-0 z-30 mt-1 flex min-w-[200px] flex-col gap-1 rounded-lg border border-line bg-white p-1 shadow-popover"
        >
          {mode === 'member' &&
            others.map((sg) => (
              <li key={sg.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="w-full rounded-lg p-2 text-left text-13 font-medium text-ink transition hover:bg-gray-50"
                  onClick={() => choose({ kind: 'move', targetSubgroupId: sg.id })}
                >
                  Перенести в «{sg.name}»
                </button>
              </li>
            ))}
          {mode === 'member' && (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="w-full rounded-lg p-2 text-left text-13 font-medium text-red-600 transition hover:bg-red-50"
                onClick={() => choose({ kind: 'remove' })}
              >
                Убрать из группы
              </button>
            </li>
          )}
          {mode === 'unassigned' &&
            (subgroups.length === 0 ? (
              <li className="p-2 text-13 text-gray-400">Сначала создайте подгруппу</li>
            ) : (
              subgroups.map((sg) => (
                <li key={sg.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-lg p-2 text-left text-13 font-medium text-ink transition hover:bg-gray-50"
                    onClick={() => choose({ kind: 'add', targetSubgroupId: sg.id })}
                  >
                    Добавить в «{sg.name}»
                  </button>
                </li>
              ))
            ))}
        </ul>
      )}
    </div>
  );
}
