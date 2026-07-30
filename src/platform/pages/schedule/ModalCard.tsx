import { useEffect, type ReactNode } from 'react';
import { cx } from '@/lib/format';

/**
 * Общая оболочка модалок экрана расписания.
 *
 * Во всех макетах (2015:13828, 14239, 14646, 15040, 15829, 16289, 16715,
 * 17138, 17554, 17959) карточка одинаковая: белая, radius 12, тень
 * 0 16px 16px rgba(0,0,0,.12). Различаются только ширина, padding и gap —
 * их задаёт вызывающий через className.
 *
 * Общий ui/Modal не подошёл: у него крестик, разделители шапки и подвала
 * и radius 16 — ничего этого в макетах нет.
 */
export function ModalCard({
  open,
  onClose,
  labelledBy,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-slate-900/40 animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cx(
          'relative my-auto flex w-full flex-col rounded-xl bg-white shadow-dialog animate-scale-in',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** modal-actions: справа, gap 12. */
export function ModalActions({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cx('flex items-center justify-end gap-3', className)}>{children}</div>;
}

/** btn-secondary: рамка #e5e7eb, px 16 / py 10, 14px SemiBold. */
export const MODAL_SECONDARY =
  'rounded-lg border border-line px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * btn-primary: заливка, px 20 / py 10, 14px SemiBold, белый текст.
 * Disabled в макетах — заливка #e5e7eb и текст #9ca3af (2015:15056, 2015:16311).
 */
export const MODAL_PRIMARY =
  'rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-line disabled:text-gray-400';
