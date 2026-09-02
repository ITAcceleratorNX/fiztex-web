import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pluralRu } from '@/lib/format';

/**
 * Постраничная навигация под серверной выдачей.
 *
 * Числа приходят из ответа (`totalElements`, `totalPages`), а не считаются по длине
 * страницы: в разделах Super Admin выдача может быть на тысячи строк, и «1–20 из 20»
 * под каждой страницей врало бы.
 */
export function Pager({
  page,
  totalPages,
  total,
  pageSize,
  unit,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  unit: [string, string, string];
  onPage: (next: number) => void;
}) {
  if (total === 0) return null;

  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex h-11 items-center justify-between border-t border-line bg-neutral-bg/40 px-5 text-13 text-subtle">
      <span>
        {from}–{to} из {total.toLocaleString('ru-RU')} {pluralRu(total, unit)}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Предыдущая страница"
          disabled={page <= 0}
          onClick={() => onPage(Math.max(0, page - 1))}
          className="flex size-8 items-center justify-center rounded-lg border border-line bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Следующая страница"
          disabled={page + 1 >= totalPages}
          onClick={() => onPage(page + 1)}
          className="flex size-8 items-center justify-center rounded-lg border border-line bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
