import { useId, type ReactElement, cloneElement } from 'react';
import { cx } from '@/lib/format';

/**
 * Тёмная подсказка над элементом (Figma 2212:8042 — «Перетащите, чтобы изменить порядок»,
 * «Удалить этап»). Показывается наведением и фокусом — с клавиатуры `title` браузера не видно.
 * Текст короткий и в одну строку; для длинных пояснений — `HoverCard`.
 *
 * Ребёнок получает `aria-describedby`, поэтому это должен быть один фокусируемый элемент.
 */
export function Tooltip({ label, children, className }: {
  label: string;
  children: ReactElement;
  className?: string;
}) {
  const id = useId();
  return (
    <span className={cx('group/tip relative inline-flex', className)}>
      {cloneElement(children, { 'aria-describedby': id })}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-11 font-medium text-white opacity-0 transition group-focus-within/tip:opacity-100 group-hover/tip:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
