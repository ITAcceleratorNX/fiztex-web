import type { ReactNode } from 'react';
import { Loader2, AlertTriangle, Inbox } from 'lucide-react';
import { Button } from './Button';
import { cx } from '@/lib/format';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={className ?? 'h-5 w-5 animate-spin text-brand-500'} />;
}

export function LoadingBlock({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400"
    >
      <Loader2 className="h-7 w-7 animate-spin text-brand-500" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-6 w-6 text-red-500" aria-hidden="true" />
      </div>
      <p role="alert" aria-live="assertive" aria-atomic="true" className="max-w-sm text-sm text-slate-600">
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}

export function EmptyBlock({
  icon,
  title,
  description,
  action,
  appearance = 'default',
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  appearance?: 'default' | 'planning';
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-3 text-center', appearance === 'planning' ? 'pb-8 pt-14' : 'py-16')}>
      <div className={cx('flex items-center justify-center rounded-2xl', appearance === 'planning' ? 'mb-2 size-16 bg-planning-period text-navy-700' : 'size-14 bg-slate-100 text-slate-400')}>
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <div>
        <p className={appearance === 'planning' ? 'text-xl font-bold text-planning-ink' : 'text-base font-semibold text-slate-700'}>{title}</p>
        {description && <p className={cx('mx-auto mt-2 text-sm leading-relaxed', appearance === 'planning' ? 'max-w-lg text-planning-muted' : 'max-w-sm text-slate-500')}>{description}</p>}
      </div>
      {action}
    </div>
  );
}
