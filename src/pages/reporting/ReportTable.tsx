import type { ReactNode } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cx } from '@/lib/format';
import type { MetricDisplay } from '@/lib/reportingModel';

/**
 * Колонка таблицы отчётности. Значения уже посчитаны сервером — колонка только решает,
 * откуда их взять и как выровнять.
 */
export interface ReportColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  /** Ширина или другие классы ячеек колонки. */
  className?: string;
  cell: (row: T) => ReactNode;
  /** Значение строки «Итого»; без него клетка пустая. */
  total?: ReactNode;
}

const HEAD = 'border-b border-line bg-canvas px-4 py-3 text-10 font-semibold uppercase tracking-filter text-slate-400';

/**
 * Таблица учебной отчётности (Figma `table-card` 2196:23234): первая строка — «Итого»
 * по всему срезу на подложке, строки ведут в детализацию шевроном справа.
 *
 * <p>Строка открывается и мышью по всей строке, и клавиатурой — кнопкой в первой
 * ячейке: щелчок по `<tr>` с клавиатуры недоступен.
 */
export function ReportTable<T>({
  label,
  columns,
  rows,
  rowKey,
  rowLabel,
  total,
  onOpen,
  selectedKey,
}: {
  label: string;
  columns: ReportColumn<T>[];
  rows: T[];
  rowKey: (row: T) => number;
  /** Подпись кнопки строки для чтения с экрана: «Открыть 8 «А»». */
  rowLabel: (row: T) => string;
  /** Строка «Итого»: подпись сверху и название среза. */
  total?: { title: string; caption?: string };
  onOpen?: (row: T) => void;
  selectedKey?: number | null;
}) {
  const [first, ...rest] = columns;
  return (
    <section aria-label={label} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col"
                  className={cx(HEAD, column.align === 'right' ? 'text-right' : 'text-left', column.className)}>
                  {column.header}
                </th>
              ))}
              {onOpen && <th scope="col" className={cx(HEAD, 'w-10')}><span className="sr-only">Открыть</span></th>}
            </tr>
          </thead>
          <tbody>
            {total && (
              <tr className="border-b border-line bg-info-bg">
                <th scope="row" className={cx('border-l-2 border-navy-700 px-4 py-3 text-left', first.className)}>
                  {total.caption && <span className="block text-11 font-normal lowercase text-navy-700">{total.caption}</span>}
                  <span className="block text-15 font-bold text-navy-700">{total.title}</span>
                </th>
                {rest.map((column) => (
                  <td key={column.key}
                    className={cx('px-4 py-3 text-15 font-bold text-navy-700', column.align === 'right' ? 'text-right' : 'text-left', column.className)}>
                    {column.total}
                  </td>
                ))}
                {onOpen && <td />}
              </tr>
            )}
            {rows.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  onClick={onOpen ? () => onOpen(row) : undefined}
                  className={cx(
                    'border-b border-line last:border-b-0',
                    onOpen && 'cursor-pointer transition hover:bg-slate-50',
                    selectedKey === key && 'bg-slate-100',
                  )}
                >
                  <th scope="row" className={cx('px-4 py-3 text-left font-semibold text-navy-700', first.className)}>
                    {onOpen ? (
                      <button
                        type="button"
                        aria-label={rowLabel(row)}
                        onClick={(event) => { event.stopPropagation(); onOpen(row); }}
                        className="text-left focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"
                      >
                        {first.cell(row)}
                      </button>
                    ) : first.cell(row)}
                  </th>
                  {rest.map((column) => (
                    <td key={column.key}
                      className={cx('px-4 py-3 text-slate-700', column.align === 'right' ? 'text-right tabular-nums' : 'text-left', column.className)}>
                      {column.cell(row)}
                    </td>
                  ))}
                  {onOpen && (
                    <td className="w-10 pr-4 text-right text-slate-400" aria-hidden="true">
                      <ChevronRight className="ml-auto h-4 w-4" />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Число отчёта. Прочерк несёт пояснение (Figma «частичные данные» 2196:22240): оно
 * всплывает при наведении и фокусе и читается экранным диктором.
 */
export function MetricCell({ value, strong = false }: { value: MetricDisplay; strong?: boolean }) {
  if (!value.hint) return <span className={cx(strong && 'font-bold')}>{value.text}</span>;
  return (
    <span
      tabIndex={0}
      aria-label={`${value.missing ? 'Нет значения' : value.text}. ${value.hint}`}
      className={cx('group relative inline-flex cursor-help focus:outline-none', strong && 'font-bold',
        value.missing && 'text-slate-400')}
    >
      <span aria-hidden="true">{value.text}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-max max-w-72 whitespace-normal rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-normal normal-case text-white shadow-popover group-hover:block group-focus:block"
      >
        {value.hint}
      </span>
    </span>
  );
}

/** Ученик в строке: кружок с инициалами и имя (Figma 2196:22687). */
export function StudentName({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-3 font-semibold text-ink">
      <Avatar name={name} size="sm" variant="navy" />
      <span>{name}</span>
    </span>
  );
}

/**
 * «Для части … данные отсутствуют — итоги посчитаны по доступным данным» (Figma
 * 2196:22240): строка «Итого» посчитана сервером по тому, что есть, и экран это говорит.
 */
export function PartialDataNotice({ subject }: { subject: string }) {
  return (
    <p role="note" className="flex items-center gap-3 rounded-xl bg-info-bg px-4 py-3 text-13 text-navy-700">
      <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
      Для части {subject} данные отсутствуют — итоги посчитаны по доступным данным
    </p>
  );
}
