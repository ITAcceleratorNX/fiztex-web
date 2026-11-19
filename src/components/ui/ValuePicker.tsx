import { useEffect, useRef, useState } from 'react';
import { cx } from '@/lib/format';
import { AnchoredPanel } from './AnchoredPanel';

export interface ValuePickerOption<T extends string | number> {
  value: T;
  label: string;
}

/**
 * Компактный выбор одного значения: поле со значением, по нажатию — панель вариантов сеткой
 * (Figma «Итоговая аттестация» Б3 2224:4586, колонка «Итог 1 полугодия»). Там, где ряд из десяти
 * кнопок не помещается рядом с процентами четвертей и рекомендацией.
 *
 * Панель — `AnchoredPanel` (портал, `fixed`): в ячейке таблицы с прокруткой она не обрезается и не
 * уходит под боковое меню. Открывшись, фокус встаёт на отмеченное значение; Escape и щелчок мимо
 * закрывают её и возвращают фокус на поле.
 */
export function ValuePicker<T extends string | number>({
  value,
  options,
  onChoose,
  ariaLabel,
  disabled = false,
  invalid = false,
}: {
  value: T | null;
  options: ReadonlyArray<ValuePickerOption<T>>;
  onChoose: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${selected?.label ?? 'не выбрано'}`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cx(
          'flex h-10 min-w-14 items-center justify-center rounded-lg border bg-surface px-3 text-15 font-bold shadow-sm transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
          'disabled:cursor-not-allowed disabled:opacity-60',
          invalid ? 'border-red-300' : 'border-line hover:border-navy-400',
          selected ? 'text-ink' : 'text-slate-300',
        )}
      >
        {selected?.label ?? '—'}
      </button>
      {open && (
        <AnchoredPanel
          ref={panelRef}
          role="dialog"
          aria-label={ariaLabel}
          className="w-[232px] rounded-xl border border-line bg-surface p-2 shadow-popover"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <div className="grid grid-cols-5 gap-1">
            {options.map((option) => {
              const pressed = option.value === value;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => {
                    setOpen(false);
                    onChoose(option.value);
                  }}
                  className={cx(
                    'h-9 rounded-lg text-13 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
                    pressed ? 'bg-navy-700 text-white' : 'text-slate-700 hover:bg-navy-50 hover:text-navy-700',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </AnchoredPanel>
      )}
    </span>
  );
}
