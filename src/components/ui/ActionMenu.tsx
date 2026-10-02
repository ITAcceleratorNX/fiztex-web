import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function ActionMenu({ label, items }: { label: string; items: ActionMenuItem[] }) {
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
      className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"
    ><MoreHorizontal className="size-5" aria-hidden="true" /></button>
    {open && <div id={menuId} className="absolute right-0 top-9 z-20 w-64 rounded-xl border border-slate-200 bg-white p-1 shadow-popover">
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
