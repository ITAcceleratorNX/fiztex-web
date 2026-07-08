import type { ReactNode } from 'react';
import { cx } from '@/lib/format';

type Tone = 'green' | 'gray' | 'amber' | 'blue' | 'red' | 'purple';

const tones: Record<Tone, { wrap: string; dot: string }> = {
  green: { wrap: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  gray: { wrap: 'bg-slate-100 text-slate-500 ring-slate-200', dot: 'bg-slate-400' },
  amber: { wrap: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  blue: { wrap: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  red: { wrap: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
  purple: { wrap: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
};

export function Badge({
  tone = 'gray',
  dot = false,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  const t = tones[tone];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        t.wrap,
      )}
    >
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', t.dot)} />}
      {children}
    </span>
  );
}
