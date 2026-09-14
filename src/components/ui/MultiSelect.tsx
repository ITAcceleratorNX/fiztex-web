import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cx } from '@/lib/format';
import { Badge } from './Badge';

export type MultiSelectOption = { value: string; label: string; disabled?: boolean };

/**
 * Выбор нескольких значений из короткого списка: выбранное стоит чипами прямо в поле, список
 * открывается тем же выпадающим меню, что у {@link Select} (Figma `Selected class` 2149:3450 —
 * «Класс(ы)» в форме учебника).
 *
 * Для списков в десяток строк. Длинный справочник с поиском по серверу — это
 * `TagSearchField`, дерево «параллель → классы» на пол-экрана — `ClassGradePicker`.
 *
 * Порядок выбранного всегда тот же, что у вариантов, а не порядок нажатий: чипы не должны
 * перескакивать, когда снимают и снова ставят галочку.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Выберите…',
  emptyLabel = 'Нет вариантов',
  disabled = false,
  error = false,
  id,
  'aria-label': ariaLabel,
}: {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Что сказать в открытом списке, когда выбирать не из чего. */
  emptyLabel?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
  'aria-label'?: string;
}) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const chosen = new Set(value);
  const selected = options.filter((option) => chosen.has(option.value));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  /**
   * Escape закрывает только список. Слушать его на `document` нельзя: там же его слушает
   * `Modal`, и нажатие внутри формы закрывало бы вместе со списком всё окно с введённым.
   */
  function onEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (!open || event.key !== 'Escape') return;
    event.stopPropagation();
    setOpen(false);
  }

  function toggle(option: MultiSelectOption) {
    if (option.disabled) return;
    const next = new Set(value);
    if (next.has(option.value)) next.delete(option.value);
    else next.add(option.value);
    onChange(options.filter((item) => next.has(item.value)).map((item) => item.value));
  }

  return (
    <div ref={rootRef} onKeyDown={onEscape} className="relative w-full">
      <button
        type="button"
        id={triggerId}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${triggerId}-listbox`}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={cx(
          'input-base flex min-h-11 items-center justify-between gap-2 py-1.5 text-left',
          'cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
          error && 'border-red-300',
        )}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          {selected.length > 0 ? (
            selected.map((option) => (
              <Badge key={option.value} tone="navy">
                {option.label}
              </Badge>
            ))
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={cx('size-4 shrink-0 text-slate-400 transition', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          id={`${triggerId}-listbox`}
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={triggerId}
          className="absolute inset-x-0 z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl bg-white py-1 shadow-pop ring-1 ring-slate-200/80 animate-scale-in"
        >
          {options.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-slate-400">{emptyLabel}</li>
          ) : (
            options.map((option) => {
              const isSelected = chosen.has(option.value);
              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onClick={() => toggle(option)}
                    className={cx(
                      'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition',
                      option.disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-slate-50',
                      isSelected ? 'font-medium text-navy-700' : 'text-slate-700',
                    )}
                  >
                    <span
                      className={cx(
                        'flex size-4 shrink-0 items-center justify-center rounded border',
                        isSelected ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-300',
                      )}
                      aria-hidden
                    >
                      {isSelected && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
