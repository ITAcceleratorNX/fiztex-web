import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function ActionMenu({ label, items, triggerLabel }: { label: string; items: ActionMenuItem[]; triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return <div ref={rootRef} className="relative shrink-0">
    <button
      ref={triggerRef}
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onClick={() => setOpen((value) => !value)}
      className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-muted transition hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 ${triggerLabel ? 'border border-line bg-surface px-3' : 'w-11'}`}
    ><MoreHorizontal className="size-5" aria-hidden="true" />{triggerLabel}</button>
    {open && <div id={menuId} className="absolute right-0 top-full z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-1 shadow-popover">
      {items.map((item, index) => <button
        key={`${item.label}-${index}`}
        type="button"
        disabled={item.disabled}
        onClick={() => { setOpen(false); item.onSelect(); }}
        className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-900 hover:bg-slate-50'}`}
      >{item.label}</button>)}
    </div>}
  </div>;
}
