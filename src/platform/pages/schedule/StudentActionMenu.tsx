import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cx } from '@/lib/format';
import type { Subgroup } from '@/lib/schedule2bTypes';

export type StudentMenuAction =
  | { kind: 'move'; targetSubgroupId: number }
  | { kind: 'remove' }
  | { kind: 'add'; targetSubgroupId: number };

/**
 * Keyboard-accessible action menu (no drag-n-drop).
 * mode=member: move to other + remove; mode=unassigned: add to …
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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={`Действия: ${studentLabel}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cx(
          'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition',
          'hover:bg-slate-100 hover:text-slate-700',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <ul
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[12rem] overflow-hidden rounded-xl bg-white py-1 shadow-pop ring-1 ring-slate-200/80"
        >
          {mode === 'member' &&
            others.map((sg) => (
              <li key={sg.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
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
                className="block w-full px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                onClick={() => choose({ kind: 'remove' })}
              >
                Убрать из подгруппы
              </button>
            </li>
          )}
          {mode === 'unassigned' &&
            (subgroups.length === 0 ? (
              <li className="px-3.5 py-2 text-sm text-slate-400">Сначала создайте подгруппу</li>
            ) : (
              subgroups.map((sg) => (
                <li key={sg.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
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
