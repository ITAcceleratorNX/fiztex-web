import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { cx } from '@/lib/format';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  push: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = (counter += 1);
      setToasts((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-80 flex-col gap-2.5">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const config = {
    success: { icon: CheckCircle2, ring: 'ring-emerald-200', accent: 'text-emerald-500' },
    error: { icon: XCircle, ring: 'ring-red-200', accent: 'text-red-500' },
    info: { icon: Info, ring: 'ring-sky-200', accent: 'text-sky-500' },
  }[toast.kind];
  const Icon = config.icon;
  return (
    <div
      className={cx(
        'pointer-events-auto flex items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-pop ring-1 animate-slide-in',
        config.ring,
      )}
    >
      <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', config.accent)} />
      <p className="flex-1 text-sm text-slate-700">{toast.message}</p>
      <button onClick={onClose} className="text-slate-400 transition hover:text-slate-600">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
