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
 *
 * `outlined` — переключатель в строке фильтров над таблицей (Figma `phyztex` 2460:1979,
 * «Новые / Одобрены / Отклонены»): белая дорожка с рамкой высотой с поле поиска (44),
 * сегменты 32 на радиусе 8, активный — фирменный navy.
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
  appearance?: 'default' | 'planning' | 'outlined';
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
      className={cx(
        'inline-flex gap-1 rounded-xl p-1',
        appearance === 'planning'
          ? 'self-start bg-planning-row-line'
          : appearance === 'outlined'
            ? 'h-11 shrink-0 items-center border border-line bg-surface'
            : 'bg-neutral-bg',
        className,
      )}
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
              'rounded-lg transition',
              appearance === 'outlined'
                ? 'h-8 whitespace-nowrap px-3.5 text-sm'
                : cx('py-2 font-semibold', appearance === 'planning' ? 'px-3 text-13' : 'px-4 text-sm'),
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 disabled:cursor-not-allowed disabled:opacity-50',
              appearance === 'planning'
                ? selected ? 'bg-white text-navy-700 shadow-sm' : 'text-planning-muted hover:text-navy-700'
                : appearance === 'outlined'
                  ? selected ? 'bg-navy-700 font-semibold text-white' : 'font-medium text-slate-600 hover:text-navy-700'
                  : selected ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
