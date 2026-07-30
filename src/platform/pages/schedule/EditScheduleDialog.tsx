import { Loader2 } from 'lucide-react';
import { cx } from '@/lib/format';
import { ModalActions, ModalCard, MODAL_PRIMARY, MODAL_SECONDARY } from './ModalCard';

/**
 * Предупреждение перед редактированием опубликованного расписания.
 * Figma 2015:17959 — карточка 480, p 32, gap 24.
 */
export function EditScheduleDialog({
  open,
  className,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  /** Название класса для подстановки в текст, например «8А». */
  className?: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalCard
      open={open}
      onClose={onClose}
      labelledBy="edit-schedule-title"
      className="max-w-[480px] gap-6 p-8"
    >
      {/* 2015:17960 — modal-header, gap 8 */}
      <div className="flex flex-col gap-2">
        <h2 id="edit-schedule-title" className="text-lg font-bold text-ink">
          Это опубликованное расписание
        </h2>
        <p className="text-sm leading-5 text-muted">
          Изменения затронут действующее расписание
          {className ? ` класса ${className}` : ''}.
        </p>
      </div>

      <ModalActions>
        <button type="button" onClick={onClose} className={cx(MODAL_SECONDARY, 'text-ink')}>
          Отменить
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={cx(
            MODAL_PRIMARY,
            'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600',
          )}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Редактировать всё равно
        </button>
      </ModalActions>
    </ModalCard>
  );
}
