import { Check, AlertCircle } from 'lucide-react';
import { cx } from '@/lib/format';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function SaveStatusChip({
  status,
  onRetry,
}: {
  status: SaveStatus;
  onRetry?: () => void;
}) {
  if (status === 'idle') return null;

  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-slate-400">
        Сохранение…
      </span>
    );
  }

  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
        <Check className="size-4" strokeWidth={2.5} />
        Ответ сохранён
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600">
        <AlertCircle className="size-4" />
        Не сохранено
      </span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={cx('text-sm font-semibold text-brand-500 transition hover:text-brand-600')}
        >
          Повторить
        </button>
      ) : null}
    </span>
  );
}
