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
      <span className="inline-flex items-center rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
        Сохранение…
      </span>
    );
  }

  if (status === 'saved') {
    return (
      <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
        Сохранено
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
        Не сохранено — проверьте интернет
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cx(
            'rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition hover:bg-brand-50',
          )}
        >
          Повторить
        </button>
      )}
    </span>
  );
}
