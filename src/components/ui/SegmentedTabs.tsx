import { cx } from '@/lib/format';

/**
 * Переключатель из двух-трёх равноправных наборов данных (Figma 856:20520 —
 * «Актуальные / История»).
 *
 * Отдельно от {@link Tabs}: там подчёркивание под заголовком раздела, здесь пилюля на
 * серой дорожке. Разница не косметическая — этот вид применяют там, где вкладка меняет
 * выборку, а не часть страницы, поэтому у него всегда виден весь набор вариантов.
 *
 * Геометрия из макета: дорожка радиус 12 / p 4, активный сегмент — белый на радиусе 8.
 */
export function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx('inline-flex gap-1 rounded-xl bg-neutral-bg p-1', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-lg px-4 py-2 text-sm font-semibold transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50',
              selected ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
