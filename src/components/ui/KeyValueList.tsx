import type { ReactNode } from 'react';
import { cx } from '@/lib/format';

export interface KeyValueRow {
  key: string;
  label: ReactNode;
  value: ReactNode;
  /** Справа строки — обычно плашка источника («из КТП», «из расписания»). */
  aside?: ReactNode;
}

/**
 * Список «метка — значение — источник» в рамке (Figma `КСП / Строка данных` 2212:8019):
 * данные урока на подготовке КСП и исходные данные генерации. Только чтение: правка живёт
 * в полях формы, а не в этих строках.
 */
export function KeyValueList({ rows, className }: { rows: KeyValueRow[]; className?: string }) {
  return (
    <dl className={cx('divide-y divide-planning-row-line rounded-xl border border-planning-line bg-surface', className)}>
      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-data-row items-start gap-3 px-3 py-2.5">
          <dt className="text-13 text-planning-muted">{row.label}</dt>
          <dd className="min-w-0 whitespace-pre-line break-words text-sm font-medium text-ink">{row.value}</dd>
          <dd className="justify-self-end">{row.aside}</dd>
        </div>
      ))}
    </dl>
  );
}
