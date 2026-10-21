import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  description?: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function ActionMenu({ label, items, triggerLabel, appearance = 'default', placement = 'inline' }: { label: string; items: ActionMenuItem[]; triggerLabel?: string; appearance?: 'default' | 'link' | 'compact'; placement?: 'inline' | 'viewport' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const [position, setPosition] = useState<{ top: number; left: number }>();

  useEffect(() => {
    if (!open || placement !== 'viewport' || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const height = items.reduce((sum, item) => sum + (item.description ? 72 : 40), 8);
    const width = items.some(item => item.description) ? 320 : 256;
    setPosition({ left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)), top: rect.bottom + height + 8 < window.innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - height - 4) });
    const dismiss = () => setOpen(false);
    window.addEventListener('scroll', dismiss, true); window.addEventListener('resize', dismiss);
    return () => { window.removeEventListener('scroll', dismiss, true); window.removeEventListener('resize', dismiss); };
  }, [open, placement, items.length]);

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
      className={appearance === 'link' ? 'rounded text-13 font-semibold text-navy-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700' : appearance === 'compact' ? 'flex size-7 items-center justify-center rounded-lg text-planning-subtle hover:bg-planning-period focus-visible:ring-2 focus-visible:ring-navy-700' : `flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-muted transition hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 ${triggerLabel ? 'border border-line bg-surface px-3' : 'w-11'}`}
    >{appearance !== 'link' && <MoreHorizontal className="size-5" aria-hidden="true" />}{triggerLabel ?? (appearance === 'link' ? label : null)}</button>
    {open && <div id={menuId} style={placement === 'viewport' ? { position: 'fixed', top: position?.top, left: position?.left } : undefined} className={`${placement === 'viewport' ? '' : 'absolute right-0 top-full mt-1'} z-30 ${items.some(item => item.description) ? 'w-80' : 'w-64'} max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-popover`}>
      {items.map((item, index) => <button
        key={`${item.label}-${index}`}
        type="button"
        aria-label={item.label}
        aria-describedby={item.description ? `${menuId}-${index}` : undefined}
        disabled={item.disabled}
        onClick={() => { setOpen(false); item.onSelect(); }}
        className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-900 hover:bg-slate-50'}`}
      ><span>{item.label}</span>{item.description && <span id={`${menuId}-${index}`} className="mt-1 block text-xs font-normal leading-relaxed text-muted">{item.description}</span>}</button>)}
    </div>}
  </div>;
}
