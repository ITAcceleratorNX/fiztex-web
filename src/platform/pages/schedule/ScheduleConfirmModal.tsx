import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '@/lib/format';
import { ModalActions, ModalCard, MODAL_PRIMARY, MODAL_SECONDARY } from './ModalCard';

/**
 * Подтверждение в стиле модалок расписания: карточка 440, p 24, gap 20,
 * заголовок 20px Bold, текст 13px muted, кнопки справа (по образцу 2015:17959).
 *
 * Общий ui/ConfirmDialog не подошёл по той же причине, что и ui/Modal:
 * крестик, разделители и radius 16 — ничего этого в макетах нет.
 */
export function ScheduleConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <ModalCard
      open={open}
      onClose={onClose}
      labelledBy="schedule-confirm-title"
      className="max-w-[440px] gap-5 p-6"
    >
      <div className="flex flex-col gap-2">
        <h2 id="schedule-confirm-title" className="text-xl font-bold text-ink">
          {title}
        </h2>
        <div className="text-13 leading-relaxed text-muted">{message}</div>
      </div>

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className={cx(MODAL_SECONDARY, 'text-muted')}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={cx(
            MODAL_PRIMARY,
            'inline-flex items-center gap-2',
            danger ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-500 hover:bg-brand-600',
          )}
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {confirmLabel}
        </button>
      </ModalActions>
    </ModalCard>
  );
}
