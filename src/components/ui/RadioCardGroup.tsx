import type { ReactNode } from 'react';
import { cx } from '@/lib/format';
import { useFieldControlProps } from './fieldContext';
import { handleRovingFocusKeyDown } from './rovingFocus';

export interface RadioCardOption<T extends string> {
  value: T;
  title: string;
  description?: ReactNode;
  /** Плашка рядом с заголовком — «по умолчанию» (Figma «Настройка аттестации» 2224:1877). */
  badge?: string;
  disabled?: boolean;
}

/**
 * Выбор одного из нескольких вариантов карточками: кружок, заголовок, пояснение (Figma
 * «Настройка аттестации» А3, 2224:1877 — «Итоговая оценка», «Период аттестации», «СОЧ»).
 *
 * Выбранная карточка — тёмно-синяя рамка на `navy-50`. Это радиогруппа: стрелки переключают
 * вариант, как у `SegmentedTabs`, а подпись берётся у обёртки `Field`.
 */
export function RadioCardGroup<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  className,
}: {
  value: T | null;
  options: ReadonlyArray<RadioCardOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const fieldProps = useFieldControlProps();
  const tabStop = options.some((option) => option.value === value && !option.disabled)
    ? value
    : options.find((option) => !option.disabled)?.value;

  return (
    <div
      id={fieldProps.id}
      role="radiogroup"
      aria-label={fieldProps['aria-labelledby'] ? undefined : ariaLabel}
      aria-labelledby={fieldProps['aria-labelledby']}
      aria-describedby={fieldProps['aria-describedby']}
      aria-required={fieldProps['aria-required']}
      className={cx('grid gap-3 sm:grid-cols-2', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={option.value === tabStop ? 0 : -1}
            disabled={disabled || option.disabled}
            onKeyDown={(event) => handleRovingFocusKeyDown(event, {
              itemSelector: '[role="radio"]:not(:disabled)',
              activateOnArrow: true,
            })}
            onClick={() => onChange(option.value)}
            className={cx(
              'flex items-start gap-3 rounded-xl border p-4 text-left transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-60',
              selected ? 'border-navy-700 bg-navy-50' : 'border-line bg-surface hover:border-navy-400',
            )}
          >
            <span
              aria-hidden
              className={cx(
                'mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2',
                selected ? 'border-navy-700' : 'border-slate-300',
              )}
            >
              {selected && <span className="size-2 rounded-full bg-navy-700" />}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-15 font-semibold text-ink">{option.title}</span>
                {option.badge && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-11 font-medium text-slate-600">{option.badge}</span>
                )}
              </span>
              {option.description && <span className="text-13 text-muted">{option.description}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
