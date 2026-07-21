import { useEffect, useRef, useState } from 'react';
import { Archive, Lock, MoreVertical, RotateCw, Unlock } from 'lucide-react';
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
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 w-56 overflow-hidden rounded-xl bg-white py-1.5 shadow-pop ring-1 ring-slate-200/70">
          {onResetAccess && !archived && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onResetAccess();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <RotateCw className="h-4 w-4 text-slate-400" />
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
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Unlock className="h-4 w-4 text-slate-400" />
                Разблокировать аккаунт
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onBlock();
                }}
                className={cx(
                  'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50',
                )}
              >
                <Lock className="h-4 w-4" />
                Заблокировать аккаунт
              </button>
            ))}
          {!archived && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onArchive();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Archive className="h-4 w-4 text-slate-400" />
              Перевести в архив
            </button>
          )}
        </div>
      )}
    </div>
  );
}
