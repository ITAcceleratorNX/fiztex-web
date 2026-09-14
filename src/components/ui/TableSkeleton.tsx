import { cx } from '@/lib/format';

/** Длины полос по кругу: одинаковые полосы читаются как пустая таблица, а не как загрузка. */
const BAR_WIDTHS = ['w-3/5', 'w-4/5', 'w-2/3', 'w-3/4', 'w-1/2', 'w-5/6'];

/**
 * Скелет строк таблицы на время загрузки (Figma `skeleton-row` 2149:4029).
 *
 * Колонки передаются теми же классами ширины, что и у настоящей таблицы: скелет обязан
 * совпасть с ней по сетке, иначе при появлении данных строка «прыгает».
 */
export function TableSkeleton({
  columns,
  rows = 5,
  label = 'Загрузка…',
}: {
  /** Классы ширины колонок, например `['w-20', 'w-80', 'flex-1']`. */
  columns: string[];
  rows?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="animate-pulse">
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="flex items-center border-b border-slate-100 px-4 py-4 last:border-b-0"
        >
          {columns.map((column, col) => (
            <div key={col} className={cx('shrink-0 pr-4', column)}>
              <div
                className={cx(
                  'h-3.5 rounded bg-slate-100',
                  BAR_WIDTHS[(row + col * 2) % BAR_WIDTHS.length],
                )}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
