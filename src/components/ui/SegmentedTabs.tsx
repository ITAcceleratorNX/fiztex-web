import { cx } from '@/lib/format';
import { handleRovingFocusKeyDown } from './rovingFocus';

/**
 * Переключатель из двух-трёх равноправных наборов данных (Figma 856:20520 —
 * «Актуальные / История»).
 *
 * Отдельно от {@link Tabs}: там переключаются панели страницы, здесь выбирается значение
 * (набор данных или формат ответа). Поэтому в доступном дереве это группа радиокнопок,
 * а не tablist без связанных панелей.
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
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean }>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const selectedEnabled = options.some((option) => option.value === value && !option.disabled);
  const tabStopValue = selectedEnabled ? value : options.find((option) => !option.disabled)?.value;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={cx('inline-flex gap-1 rounded-xl bg-neutral-bg p-1', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={option.value === tabStopValue ? 0 : -1}
            disabled={option.disabled}
            onKeyDown={(event) => handleRovingFocusKeyDown(event, {
              itemSelector: '[role="radio"]:not(:disabled)',
              activateOnArrow: true,
            })}
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-lg px-4 py-2 text-sm font-semibold transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 disabled:cursor-not-allowed disabled:opacity-50',
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
