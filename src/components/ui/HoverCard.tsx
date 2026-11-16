import { useId, useState, type ReactNode } from 'react';
import { AnchoredPanel } from './AnchoredPanel';

/**
 * Карточка-подсказка у значка: открывается наведением и фокусом, закрывается уходом и Escape
 * (причина ВНА/НА в итоге четверти, Figma 2209:178 «Причина не аттестован»).
 *
 * Не `title`: текст причины длинный, у него есть заголовок, и браузерная подсказка его обрезает
 * и не показывается с клавиатуры. Карточка уходит порталом (`AnchoredPanel`), поэтому её не режет
 * прокручиваемая таблица. Внутри нет кнопок — фокус остаётся на значке.
 */
export function HoverCard({
  trigger,
  label,
  title,
  children,
}: {
  /** Значок; рисуется внутри кнопки с `aria-label`. */
  trigger: ReactNode;
  /** Название значка для скринридера и под курсором до раскрытия. */
  label: string;
  /** Подпись карточки — капителью над текстом. */
  title?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
        className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-300 aria-expanded:bg-slate-100 aria-expanded:text-navy-700"
      >
        {trigger}
      </button>
      {open && (
        <AnchoredPanel
          id={id}
          role="tooltip"
          className="w-72 rounded-xl bg-white p-3 text-left shadow-popover ring-1 ring-slate-200"
        >
          {title && <p className="text-11 font-bold uppercase text-slate-400">{title}</p>}
          <div className="mt-1 text-13 text-ink">{children}</div>
        </AnchoredPanel>
      )}
    </span>
  );
}
