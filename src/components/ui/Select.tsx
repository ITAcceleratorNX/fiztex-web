import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type ChangeEvent,
  type SelectHTMLAttributes,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cx } from '@/lib/format';

type OptionItem = { value: string; label: string; disabled?: boolean };

function parseOptions(children: ReactNode): OptionItem[] {
  return Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const el = child as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>;
      return {
        value: String(el.props.value ?? ''),
        label: String(el.props.children ?? ''),
        disabled: el.props.disabled,
      };
    });
}

export function Select({
  className,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  name,
  id,
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId();
  const listboxId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const options = parseOptions(children);
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(String(defaultValue ?? options[0]?.value ?? ''));
  const [open, setOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState<number>();

  const currentValue = isControlled ? String(value ?? '') : internalValue;
  const selected = options.find((o) => o.value === currentValue);
  const isEmpty = currentValue === '';

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && triggerRef.current) {
      setMenuWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  function emitChange(nextValue: string) {
    if (!isControlled) setInternalValue(nextValue);
    onChange?.({
      target: { value: nextValue, name: name ?? '' },
      currentTarget: { value: nextValue, name: name ?? '' },
    } as ChangeEvent<HTMLSelectElement>);
  }

  function choose(option: OptionItem) {
    if (option.disabled) return;
    emitChange(option.value);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cx('relative', className?.includes('w-auto') ? 'inline-block' : 'w-full')}>
      {name && <input type="hidden" name={name} value={currentValue} />}

      <button
        ref={triggerRef}
        type="button"
        id={listboxId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${listboxId}-listbox`}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={cx(
          'input-base flex items-center justify-between gap-2 text-left',
          'cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
      >
        <span className={cx('truncate', isEmpty && 'text-slate-400')}>
          {selected?.label ?? 'Выберите…'}
        </span>
        <ChevronDown
          className={cx('h-4 w-4 shrink-0 text-slate-400 transition', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          id={`${listboxId}-listbox`}
          role="listbox"
          aria-labelledby={listboxId}
          style={menuWidth ? { minWidth: menuWidth } : undefined}
          className={cx(
            'absolute z-30 mt-1 max-h-60 overflow-y-auto rounded-xl bg-white py-1 shadow-pop ring-1 ring-slate-200/80 animate-scale-in',
            className?.includes('w-auto') ? 'left-0' : 'inset-x-0 w-full',
          )}
        >
          {options.map((option) => {
            const isSelected = option.value === currentValue;
            return (
              <li key={`${option.value}-${option.label}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onClick={() => choose(option)}
                  className={cx(
                    'flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition',
                    option.disabled && 'cursor-not-allowed opacity-45',
                    !option.disabled && 'hover:bg-slate-50',
                    isSelected ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-700',
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-brand-500" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
