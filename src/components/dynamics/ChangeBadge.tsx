import { ArrowDown, ArrowUp } from 'lucide-react';
import { cx } from '@/lib/format';
import { changeBadge, type DynamicsMetric } from '@/lib/dynamicsModel';

const TONES = {
  growth: 'bg-green-100 text-green-700',
  decline: 'bg-red-50 text-red-600',
  stable: 'bg-slate-100 text-slate-600',
  neutral: 'bg-slate-100 text-slate-500',
} as const;

/**
 * Изменение к прошлому периоду (Figma «+0,3», «−0,4», «0,0 Стабильно», «Нет данных для
 * сравнения»). Число и статус — с сервера; без сравнения число не рисуется вовсе.
 */
export function ChangeBadge({ metric, withStatus = false, className }: {
  metric: DynamicsMetric | null | undefined;
  /** «↑ +0,2 Рост» — у сводки класса. */
  withStatus?: boolean;
  className?: string;
}) {
  const badge = changeBadge(metric);
  const status = withStatus && (badge.tone === 'growth' ? 'Рост' : badge.tone === 'decline' ? 'Снижение' : null);
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-13 font-semibold', TONES[badge.tone], className)}>
      {withStatus && badge.tone === 'growth' && <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />}
      {withStatus && badge.tone === 'decline' && <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />}
      {badge.text}
      {status && <span>{status}</span>}
    </span>
  );
}
