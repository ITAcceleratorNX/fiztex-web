import type { ComponentProps, ReactNode } from 'react';
import { cx } from '@/lib/format';
import { ChevronDown } from 'lucide-react';

/** Semantic, horizontally scrollable table shared by plan review and progress. */
export function DataTable({ children, label, appearance = 'default' }: { children: ReactNode; label: string; appearance?: 'default' | 'planning' | 'planning-list' }) {
  return <div tabIndex={0} role="region" aria-label={label} className={cx('overflow-x-auto border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700', appearance !== 'default' ? 'rounded-planning-panel border-planning-line' : 'rounded-xl border-line')}>
    <table aria-label={label} className={cx('w-full border-collapse text-left text-13', appearance !== 'default' ? 'min-w-planning-table text-planning-ink [&_td]:planning-table-cell [&_th[scope=col]]:planning-table-head' : 'text-ink', appearance === 'planning-list' && '[&_td]:px-4 [&_td]:py-3.5 [&_td]:text-sm')}>{children}</table>
  </div>;
}
export function TableGroupRow({ columns, children, expanded, onToggle, summary }: { columns: number; children: ReactNode; expanded: boolean; onToggle: () => void; summary?: ReactNode }) {
  return <tr><th colSpan={columns} scope="rowgroup" className="border-b border-planning-row-line bg-planning-period text-left">
    <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex w-full items-center justify-between gap-4 px-3 py-3 text-left text-13 font-bold text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-700">
      <span>{children}</span>{summary && <span className="ml-auto text-xs font-semibold text-planning-muted">{summary}</span>}<ChevronDown className={cx('size-4 shrink-0 transition', expanded && 'rotate-180')} aria-hidden="true" />
    </button>
  </th></tr>;
}
export function TableSectionRow({ columns, children }: { columns: number; children: ReactNode }) {
  return <tr><th colSpan={columns} scope="rowgroup" className="bg-surface px-3 pb-2 pt-3 text-left text-sm font-bold text-planning-ink">{children}</th></tr>;
}
export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return <th scope="col" {...props} className={cx('border-b border-line bg-neutral-bg px-4 py-3 text-xs font-semibold uppercase text-muted', className)} />;
}
export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td {...props} className={cx('border-b border-line px-4 py-4 align-top last:border-r-0', className)} />;
}
