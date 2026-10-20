import { cx } from '@/lib/format';
import { handleRovingFocusKeyDown } from './rovingFocus';
import { useFieldControlProps } from './fieldContext';

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
  appearance = 'default',
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean }>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  appearance?: 'default' | 'planning';
}) {
  const selectedEnabled = options.some((option) => option.value === value && !option.disabled);
  const tabStopValue = selectedEnabled ? value : options.find((option) => !option.disabled)?.value;
  const fieldProps = useFieldControlProps();

  return (
    <div
      id={fieldProps.id}
      role="radiogroup"
      aria-label={fieldProps['aria-labelledby'] ? undefined : ariaLabel}
      aria-labelledby={fieldProps['aria-labelledby']}
      aria-describedby={fieldProps['aria-describedby']}
      aria-invalid={fieldProps['aria-invalid']}
      aria-required={fieldProps['aria-required']}
      aria-orientation="horizontal"
      className={cx('inline-flex gap-1 rounded-xl p-1', appearance === 'planning' ? 'self-start bg-planning-row-line' : 'bg-neutral-bg', className)}
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
              'rounded-lg py-2 font-semibold transition',
              appearance === 'planning' ? 'px-3 text-13' : 'px-4 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 disabled:cursor-not-allowed disabled:opacity-50',
              appearance === 'planning' ? selected ? 'bg-white text-navy-700 shadow-sm' : 'text-planning-muted hover:text-navy-700' : selected ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
