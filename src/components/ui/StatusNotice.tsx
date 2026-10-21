import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cx } from '@/lib/format';

const tones = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};
export function StatusNotice({ tone = 'info', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertTriangle;
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-3 rounded-xl border px-4 py-3 text-13 leading-relaxed', tones[tone])}>
    <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><div className="min-w-0 flex-1">{children}</div>
  </div>;
}
