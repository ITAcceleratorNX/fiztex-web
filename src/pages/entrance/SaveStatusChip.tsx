import { AlertCircle } from 'lucide-react';
import { cx } from '@/lib/format';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Figma active test status: green dot + muted «Ответ сохранён». */
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
      <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[#64748b]">
        <span className="size-2 animate-pulse rounded-full bg-[#94a3b8]" />
        Сохранение…
      </span>
    );
  }

  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[#64748b]">
        <span className="size-2 rounded-full bg-[#22c55e]" />
        Ответ сохранён
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-red-600">
        <AlertCircle className="size-4" />
        Не сохранено
      </span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={cx('text-[13px] font-semibold text-brand-500 transition hover:text-brand-600')}
        >
          Повторить
        </button>
      ) : null}
    </span>
  );
}
