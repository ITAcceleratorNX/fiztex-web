import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx, pluralRu } from '@/lib/format';

export type PageSlot = number | 'gap';

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

/**
 * Номера страниц для кнопок, с нуля: первая, последняя и соседи текущей, между ними —
 * пропуск. Мест всегда семь, чтобы ряд не прыгал при листании, и пропуск прячет не меньше
 * двух страниц: на месте одной честнее показать её номер.
 */
export function pageWindow(page: number, totalPages: number): PageSlot[] {
  if (totalPages <= 7) return range(0, totalPages - 1);
  const last = totalPages - 1;
  if (page <= 3) return [...range(0, 4), 'gap', last];
  if (page >= last - 3) return [0, 'gap', ...range(last - 4, last)];
  return [0, 'gap', page - 1, page, page + 1, 'gap', last];
}

const PAGE_BUTTON = 'flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-13 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Листание реестра под таблицей: слева «26–50 из 128 заявок», справа стрелки и номера.
 *
 * Страницы считаются с нуля, как в Spring `Page`. Одна страница — ничего не рисуется:
 * листать нечего, а «1–6 из 6» лишь повторяет таблицу. В макете `phyztex` листания нет —
 * вид собран из токенов реестра (`DataTable appearance="registry"`): рамка `line`, активная
 * страница — navy, как выбранный сегмент `SegmentedTabs appearance="outlined"`.
 */
export function Pagination({
  page,
  totalPages,
  totalElements,
  pageSize,
  itemForms,
  onPageChange,
  label = 'Страницы',
  className,
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  /** Слово после «из N» — в родительном: «заявки», «заявок», «заявок». */
  itemForms: [string, string, string];
  onPageChange: (page: number) => void;
  /** Имя навигации для скринридера: «Страницы заявок». */
  label?: string;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min(totalElements, (page + 1) * pageSize);

  return (
    <nav aria-label={label} className={cx('flex flex-wrap items-center justify-between gap-3', className)}>
      <p className="text-13 text-planning-muted">
        {from}–{to} из {totalElements} {pluralRu(totalElements, itemForms)}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Предыдущая страница"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          className={cx(PAGE_BUTTON, 'border-line bg-surface text-slate-600 hover:text-navy-700')}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        {pageWindow(page, totalPages).map((slot, index) => slot === 'gap'
          ? <span key={`gap-${index}`} aria-hidden="true" className="w-6 text-center text-13 text-planning-subtle">…</span>
          : (
            <button
              key={slot}
              type="button"
              aria-label={`Страница ${slot + 1}`}
              aria-current={slot === page ? 'page' : undefined}
              onClick={() => { if (slot !== page) onPageChange(slot); }}
              className={cx(
                PAGE_BUTTON,
                slot === page
                  ? 'border-navy-700 bg-navy-700 text-white'
                  : 'border-line bg-surface text-slate-600 hover:text-navy-700',
              )}
            >
              {slot + 1}
            </button>
          ))}
        <button
          type="button"
          aria-label="Следующая страница"
          disabled={page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={cx(PAGE_BUTTON, 'border-line bg-surface text-slate-600 hover:text-navy-700')}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
