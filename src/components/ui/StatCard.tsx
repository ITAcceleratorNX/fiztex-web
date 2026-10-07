import type { LucideIcon } from 'lucide-react';
import { PhysTechMark } from '@/components/layout/Logo';

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'navy',
  variant = 'default',
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: 'navy' | 'success';
  variant?: 'default' | 'compact';
}) {
  if (variant === 'compact') {
    return (
      <div className="flex min-h-24 items-center gap-4 rounded-xl border border-line bg-surface px-5 py-4 shadow-tile">
        {Icon && (
          <span className={tone === 'success'
            ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-bg text-success-fg'
            : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700'}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-13 font-semibold uppercase tracking-wide text-subtle">{label}</p>
          <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="card relative flex flex-col justify-between overflow-hidden px-6 py-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-3 text-4xl font-extrabold text-slate-900">{value}</p>
      <PhysTechMark className="pointer-events-none absolute -right-2 top-1/2 h-20 w-20 -translate-y-1/2 text-navy-700/10" />
    </div>
  );
}
