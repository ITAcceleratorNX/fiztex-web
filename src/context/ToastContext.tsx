import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
    },
    [],
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
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex max-h-[calc(100vh-3rem)] w-[min(34rem,calc(100vw-3rem))] flex-col gap-2.5 overflow-y-auto overscroll-contain">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={remove} />
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

function autoDismissDelay(toast: Toast): number | null {
  if (toast.kind === 'error') return null;
  const wordCount = toast.message.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(30_000, Math.max(10_000, wordCount * 350));
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: number) => void }) {
  const config = TOAST_STYLES[toast.kind];
  const Icon = config.icon;
  const dismissDelay = autoDismissDelay(toast);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dueAtRef = useRef<number | null>(null);
  const remainingRef = useRef(dismissDelay ?? 0);
  const pausedRef = useRef(false);

  const startTimer = useCallback(() => {
    if (dismissDelay == null || timeoutRef.current != null || pausedRef.current) return;
    const delay = remainingRef.current;
    dueAtRef.current = Date.now() + delay;
    timeoutRef.current = setTimeout(() => onClose(toast.id), delay);
  }, [dismissDelay, onClose, toast.id]);

  const pauseTimer = useCallback(() => {
    pausedRef.current = true;
    if (timeoutRef.current == null || dueAtRef.current == null) return;
    clearTimeout(timeoutRef.current);
    remainingRef.current = Math.max(0, dueAtRef.current - Date.now());
    timeoutRef.current = null;
    dueAtRef.current = null;
  }, []);

  const resumeTimer = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    startTimer();
  }, [startTimer]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
    };
  }, [startTimer]);

  return (
    <div
      className={cx(
        'pointer-events-auto flex items-start gap-2 rounded-lg border py-2 pl-4 pr-2 animate-slide-in',
        config.box,
      )}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      onFocus={pauseTimer}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) resumeTimer();
      }}
    >
      <div
        role={toast.kind === 'error' ? 'alert' : 'status'}
        aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
        className="flex min-w-0 flex-1 items-start gap-2.5 py-1"
      >
        <Icon className={cx('mt-0.5 shrink-0', config.iconClass)} aria-hidden="true" />
        <p className={cx('min-w-0 flex-1 whitespace-pre-wrap break-words text-13 font-semibold', config.text)}>
          {toast.message}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        aria-label={toast.kind === 'error' ? 'Закрыть сообщение об ошибке' : 'Закрыть уведомление'}
        className={cx(
          'flex size-11 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy-700',
          config.boxedClose
            ? cx('rounded-[10px] border bg-white', config.closeClass)
            : config.closeClass,
        )}
      >
        <X className="size-4" aria-hidden="true" />
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
