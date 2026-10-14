import type { ReactNode } from 'react';
import { cx } from '@/lib/format';
import {
  attendanceDisplay,
  averageDisplay,
  badgeLetters,
  performanceDisplay,
  type ReportMetrics,
} from '@/lib/reportingModel';
import { MetricCell } from './ReportTable';

/**
 * Шапка детализации (Figma «Отчётность › 8 «А»» 2196:22757, «› Математика», «› Петров
 * А.А.»): плашка с буквами, название, строка контекста и три показателя среза справа.
 */
export function ReportHeaderCard({
  title,
  subtitle,
  metrics,
  badge,
  round = false,
}: {
  title: string;
  subtitle?: ReactNode;
  metrics: ReportMetrics | undefined;
  /** Текст плашки; по умолчанию — первые буквы названия. */
  badge?: string;
  /** Круглая тёмная плашка — у человека (учитель), квадратная светлая — у класса и предмета. */
  round?: boolean;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-wrap items-center gap-5 rounded-2xl border border-line bg-surface px-5 py-6 shadow-soft"
    >
      <span
        aria-hidden="true"
        className={cx(
          'flex h-12 min-w-12 shrink-0 items-center justify-center px-2 text-lg font-bold',
          round ? 'rounded-full bg-navy-700 text-white' : 'rounded-xl bg-info-bg text-navy-700',
        )}
      >
        {badge ?? badgeLetters(title)}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-2xl font-bold text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-13 text-slate-500">{subtitle}</p>}
      </div>
      <dl className="flex gap-10 text-right">
        <HeaderMetric label="Ср. балл" value={<MetricCell value={averageDisplay(metrics)} />} />
        <HeaderMetric label="Успеваемость" value={<MetricCell value={performanceDisplay(metrics)} />} />
        <HeaderMetric label="Посещаемость" value={<MetricCell value={attendanceDisplay(metrics)} />} />
      </dl>
    </section>
  );
}

function HeaderMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-10 font-semibold uppercase tracking-filter text-slate-400">{label}</dt>
      <dd className="mt-1 text-lg font-bold text-navy-700">{value}</dd>
    </div>
  );
}
