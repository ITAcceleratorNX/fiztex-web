import { useEffect, useRef, useState } from 'react';
import { Ban, Lock, MoreVertical, Trash2, Unlock } from 'lucide-react';
import { cx } from '@/lib/format';
import type { AccountStatus } from '../types';

export function AccountActionsMenu({
  status,
  onBlock,
  onUnblock,
  onArchive,
  onResetAccess,
}: {
  status: AccountStatus;
  onBlock: () => void;
  onUnblock: () => void;
  onArchive: () => void;
  /** Omit for roles without an activation-code reset flow (e.g. students use PIN reset instead). */
  onResetAccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const archived = status === 'ARCHIVED';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-8 items-center justify-center rounded-lg border border-brand-500 bg-white text-slate-500 transition hover:bg-brand-50"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-[220px] overflow-hidden rounded-xl border border-[#f3f4f6] bg-white py-0 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.02)]">
          {onResetAccess && !archived && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onResetAccess();
              }}
              className="flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Ban className="size-4 text-slate-400" />
              Сбросить доступ
            </button>
          )}
          {!archived &&
            (status === 'BLOCKED' ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onUnblock();
                }}
                className="flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Unlock className="size-4 text-slate-400" />
                Разблокировать аккаунт
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onBlock();
                }}
                className="flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px] font-semibold text-[#ef4444] transition hover:bg-red-50"
              >
                <Lock className="size-4" />
                Заблокировать аккаунт
              </button>
            ))}
          {!archived && (
            <>
              <div className="h-px bg-[#f3f4f6]" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onArchive();
                }}
                className={cx(
                  'flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px] font-semibold text-[#6b7280] transition hover:bg-slate-50',
                )}
              >
                <Trash2 className="size-4 text-slate-400" />
                Перевести в архив
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
