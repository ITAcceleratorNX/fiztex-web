import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cx } from '@/lib/format';
import { useFieldControlProps } from './fieldContext';

export interface CheckCardOption<T extends string> {
  value: T;
  title: string;
  description?: ReactNode;
  disabled?: boolean;
}

/**
 * Выбор нескольких вариантов карточками с флажком (Figma `phyztex` А2 2243:23953 — «Разделы»:
 * «Оценки», «Посещаемость», «Учебная аналитика»). Пара к {@link RadioCardGroup}: там один
 * вариант из нескольких, здесь любое их сочетание, поэтому в доступном дереве это группа
 * флажков, а не радиогруппа, и стрелки фокус не двигают — каждый флажок свой Tab-стоп.
 *
 * Карточки идут столбцом во всю ширину: подписи длинные, а сравнивать их по строкам проще.
 * Выбранная — тёмно-синяя рамка и залитый флажок (А4 2243:24741), ошибка поля — красная
 * рамка у всех карточек (А14 2243:28085): не выбран ни один вариант, виноваты все сразу.
 *
 * Порядок в `onChange` — порядок вариантов, а не нажатий: значение уходит в запрос и
 * сравнивается с прежним, и от порядка кликов оно зависеть не должно.
 */
export function CheckCardGroup<T extends string>({
  values,
  options,
  onChange,
  ariaLabel,
  error = false,
  disabled = false,
  className,
}: {
  values: ReadonlyArray<T>;
  options: ReadonlyArray<CheckCardOption<T>>;
  onChange: (values: T[]) => void;
  ariaLabel: string;
  error?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const fieldProps = useFieldControlProps({ ariaInvalid: error || undefined });
  // Ошибка приходит и пропом, и от обёртки `Field error=…` — красная рамка в обоих случаях.
  const invalid = fieldProps['aria-invalid'] === true;
  const selected = new Set(values);

  const toggle = (value: T) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(options.filter((option) => next.has(option.value)).map((option) => option.value));
  };

  return (
    <div
      id={fieldProps.id}
      role="group"
      aria-label={fieldProps['aria-labelledby'] ? undefined : ariaLabel}
      aria-labelledby={fieldProps['aria-labelledby']}
      aria-describedby={fieldProps['aria-describedby']}
      aria-invalid={fieldProps['aria-invalid']}
      className={cx('flex flex-col gap-2', className)}
    >
      {options.map((option) => {
        const checked = selected.has(option.value);
        return (
          <button
            key={option.value}
            type="button"
            role="checkbox"
            aria-checked={checked}
            disabled={disabled || option.disabled}
            onClick={() => toggle(option.value)}
            className={cx(
              'flex w-full items-center gap-3 rounded-xl border bg-surface px-4 py-3 text-left transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-60',
              checked ? 'border-navy-700' : invalid ? 'border-red-300' : 'border-slate-200 hover:border-navy-400',
            )}
          >
            <span
              aria-hidden
              className={cx(
                'flex size-5 shrink-0 items-center justify-center rounded-md border-2',
                checked ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-300',
              )}
            >
              {checked && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold leading-5 text-slate-800">{option.title}</span>
              {option.description && <span className="text-xs leading-4 text-slate-500">{option.description}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
