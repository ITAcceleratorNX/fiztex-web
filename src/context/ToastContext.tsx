import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
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
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-[min(34rem,calc(100vw-3rem))] flex-col gap-2.5">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Figma: success-toast 2015:15062, toast-error 2015:8351.
 * Общее — radius 8, текст 13px SemiBold, тонкая тень. Различаются подложка,
 * цвет рамки, размер иконки и вид кнопки закрытия.
 */
const TOAST_STYLES = {
  success: {
    icon: CheckCircle2,
    box: 'border-emerald-500 bg-emerald-50 shadow-toast',
    iconClass: 'size-4 text-emerald-500',
    text: 'text-emerald-800',
    boxedClose: false,
    closeClass: 'text-emerald-800 opacity-60 hover:opacity-100',
  },
  error: {
    icon: AlertCircle,
    box: 'border-red-200 bg-red-50 shadow-toast-error',
    iconClass: 'size-[18px] text-red-500',
    text: 'text-red-800',
    boxedClose: true,
    closeClass: 'border border-red-200 bg-white text-red-800',
  },
  // Варианта в макетах нет — собран по тем же правилам в синей гамме.
  info: {
    icon: Info,
    box: 'border-blue-300 bg-info-bg shadow-toast',
    iconClass: 'size-4 text-navy-700',
    text: 'text-navy-700',
    boxedClose: false,
    closeClass: 'text-navy-700 opacity-60 hover:opacity-100',
  },
} as const;

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const config = TOAST_STYLES[toast.kind];
  const Icon = config.icon;

  return (
    <div
      className={cx(
        'pointer-events-auto flex items-center gap-2.5 rounded-lg border py-3 pl-4 pr-3 animate-slide-in',
        config.box,
      )}
    >
      <Icon className={cx('shrink-0', config.iconClass)} aria-hidden />
      <p className={cx('flex-1 text-13 font-semibold', config.text)}>{toast.message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className={cx(
          'shrink-0 transition',
          config.boxedClose
            ? cx('flex size-5 items-center justify-center rounded-[10px]', config.closeClass)
            : config.closeClass,
        )}
      >
        <X className={config.boxedClose ? 'size-3' : 'size-4'} />
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
