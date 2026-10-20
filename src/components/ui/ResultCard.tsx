import type { ReactNode } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { cx } from '@/lib/format';

export function ResultCard({ tone, title, description, children, actions }: {
  tone: 'loading' | 'success' | 'error'; title: string; description?: ReactNode; children?: ReactNode; actions?: ReactNode;
}) {
  return <section className={cx('flex min-h-planning-state flex-col items-center justify-center rounded-planning-panel border px-6 py-12 text-center', tone === 'error' ? 'border-red-400 bg-red-50' : 'border-planning-line bg-white')}>
    {tone === 'loading' ? <span role="status" aria-label="Обработка файла" className="mb-6 size-12 animate-spin rounded-full border-4 border-dotted border-navy-700" />
      : <span className={cx('mb-5 flex size-12 items-center justify-center rounded-full text-white', tone === 'error' ? 'bg-red-500' : 'bg-emerald-500')}>{tone === 'error' ? <AlertTriangle className="size-6" /> : <Check className="size-6" />}</span>}
    <h2 role={tone === 'error' ? 'alert' : undefined} className={cx('font-bold', tone === 'loading' ? 'text-xl text-planning-ink' : tone === 'error' ? 'text-base text-red-500' : 'text-base text-planning-ink')}>{title}</h2>
    {description && <p className="mt-2 max-w-2xl text-sm text-planning-muted">{description}</p>}
    {children && <div className="mt-5 w-full max-w-xl text-sm text-planning-ink">{children}</div>}
    {actions && <div className="mt-6 flex flex-wrap items-center justify-center gap-5">{actions}</div>}
  </section>;
}
