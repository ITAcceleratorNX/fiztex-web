import { useId, type ReactNode } from 'react';
import { cx } from '@/lib/format';
import { Select } from './Select';

/**
 * Фильтр над таблицей: подпись капсом и компактный выпадающий список
 * (Figma `Filter` 2149:3130 — «Учебный год», «Период», «Предмет», «Класс»).
 *
 * Отличается от `Field` + `Select` плотностью: это строка фильтров, а не форма, и высота
 * поля 36 вместо 44 держит её в одну линию с кнопками страницы. Варианты — те же
 * `<option>`, что у `Select`.
 */
export function FilterSelect({
  label,
  value,
  onChange,
  disabled = false,
  className,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Ширина фильтра: `w-44`, `w-60` и т. п. */
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-10 font-semibold uppercase tracking-filter text-slate-400">
        {label}
      </label>
      <Select
        id={id}
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-lg border-slate-300 bg-slate-50 py-0 text-13 text-slate-700"
      >
        {children}
      </Select>
    </div>
  );
}
