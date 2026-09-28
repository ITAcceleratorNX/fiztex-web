import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type ChangeEvent,
  type KeyboardEvent,
  type SelectHTMLAttributes,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cx } from '@/lib/format';
import { useFieldControlProps } from './fieldContext';

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
  required,
  // Кнопка вместо <select>, поэтому имя поля не приходит от <label for>: без этого
  // фильтр без видимой подписи остаётся безымянным для скринридера.
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  placeholder = 'Выберите…',
}: SelectHTMLAttributes<HTMLSelectElement> & {
  /**
   * Подпись пустого поля. Пункт-заглушка `<option value="">` для этого не годится там, где
   * «ничего» выбрать нельзя: он попадает в список отмеченным пунктом.
   */
  placeholder?: string;
}) {
  const autoId = useId();
  const fieldProps = useFieldControlProps({
    id,
    ariaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
    ariaInvalid: ariaInvalid === true ? true : ariaInvalid === false ? false : undefined,
    ariaRequired,
  });
  const listboxId = fieldProps.id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeOptionRef = useRef<HTMLLIElement>(null);
  const typeaheadRef = useRef({ value: '', time: 0 });

  const options = parseOptions(children);
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(String(defaultValue ?? options[0]?.value ?? ''));
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [menuWidth, setMenuWidth] = useState<number>();

  const currentValue = isControlled ? String(value ?? '') : internalValue;
  const selected = options.find((o) => o.value === currentValue);
  const isEmpty = currentValue === '';
  const enabledOptions = options.filter((option) => !option.disabled);
  const activeOption = enabledOptions.find((option) => option.value === activeValue)
    ?? enabledOptions.find((option) => option.value === currentValue)
    ?? enabledOptions[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open && triggerRef.current) {
      setMenuWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  useLayoutEffect(() => {
    if (open) activeOptionRef.current?.focus({ preventScroll: true });
  }, [open, activeOption?.value]);

  /**
   * Escape закрывает только список. Слушать его на `document` нельзя: там же его слушает
   * `Modal`, и нажатие внутри формы закрывало бы вместе со списком всё окно с введённым.
   */
  function getInitialActiveValue() {
    return enabledOptions.find((option) => option.value === currentValue)?.value
      ?? enabledOptions[0]?.value
      ?? null;
  }

  function openMenu(value: string | null = getInitialActiveValue()) {
    setActiveValue(value);
    setOpen(true);
  }

  function closeMenu(returnFocus = false) {
    setOpen(false);
    typeaheadRef.current = { value: '', time: 0 };
    if (returnFocus) triggerRef.current?.focus();
  }

  function moveActive(direction: -1 | 1) {
    if (enabledOptions.length === 0) return;
    const currentIndex = enabledOptions.findIndex((option) => option.value === (activeOption?.value ?? currentValue));
    const nextIndex = currentIndex < 0
      ? (direction > 0 ? 0 : enabledOptions.length - 1)
      : Math.max(0, Math.min(enabledOptions.length - 1, currentIndex + direction));
    setActiveValue(enabledOptions[nextIndex].value);
  }

  function searchOptions(character: string) {
    const now = Date.now();
    const previous = typeaheadRef.current;
    const withinInterval = now - previous.time < 700;
    let query = `${withinInterval ? previous.value : ''}${character}`.toLocaleLowerCase();
    const repeatedCharacter = query.length > 1 && [...query].every((item) => item === query[0]);
    if (repeatedCharacter) query = character.toLocaleLowerCase();
    typeaheadRef.current = { value: query, time: now };

    const activeIndex = enabledOptions.findIndex((option) => option.value === (activeOption?.value ?? currentValue));
    const searchOrder = repeatedCharacter && activeIndex >= 0
      ? [...enabledOptions.slice(activeIndex + 1), ...enabledOptions.slice(0, activeIndex + 1)]
      : enabledOptions;
    return searchOrder.find((option) => option.label.toLocaleLowerCase().startsWith(query))?.value ?? null;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
      return;
    }

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openMenu();
      } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        openMenu(searchOptions(event.key));
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const option = event.key === 'Home' ? enabledOptions[0] : enabledOptions.at(-1);
      if (option) setActiveValue(option.value);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (activeOption) choose(activeOption);
    } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      const match = searchOptions(event.key);
      if (match != null) setActiveValue(match);
    }
  }

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
    setActiveValue(option.value);
    closeMenu(true);
  }

  return (
    <div
      ref={rootRef}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) closeMenu();
      }}
      className={cx('relative', className?.includes('w-auto') ? 'inline-block' : 'w-full')}
    >
      {name && <input type="hidden" name={name} value={currentValue} />}

      <button
        ref={triggerRef}
        type="button"
        id={listboxId}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={fieldProps['aria-labelledby']}
        aria-describedby={fieldProps['aria-describedby']}
        aria-invalid={fieldProps['aria-invalid']}
        aria-required={fieldProps['aria-required'] ?? (required ? true : undefined)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${listboxId}-listbox`}
        onClick={() => {
          if (disabled) return;
          if (open) closeMenu();
          else openMenu();
        }}
        className={cx(
          'input-base flex items-center justify-between gap-2 text-left',
          'cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
      >
        <span className={cx('truncate', isEmpty && 'text-slate-400')}>
          {selected?.label ?? placeholder}
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
          aria-labelledby={fieldProps['aria-labelledby'] ?? listboxId}
          style={menuWidth ? { minWidth: menuWidth } : undefined}
          className={cx(
            'absolute z-30 mt-1 max-h-60 overflow-y-auto rounded-xl bg-white py-1 shadow-pop ring-1 ring-slate-200/80 animate-scale-in',
            className?.includes('w-auto') ? 'left-0' : 'inset-x-0 w-full',
          )}
        >
          {options.map((option) => {
            const isSelected = option.value === currentValue;
            const isActive = option.value === activeOption?.value;
            return (
              <li
                key={`${option.value}-${option.label}`}
                ref={isActive ? activeOptionRef : undefined}
                id={`${listboxId}-option-${options.indexOf(option)}`}
                role="option"
                tabIndex={isActive ? 0 : -1}
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                onClick={() => choose(option)}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => {
                  if (!option.disabled) setActiveValue(option.value);
                }}
                className={cx(
                  'flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition',
                  option.disabled && 'cursor-not-allowed opacity-45',
                  !option.disabled && 'hover:bg-slate-50',
                  isSelected ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-700',
                  isActive && !option.disabled && 'outline-none ring-2 ring-inset ring-brand-400',
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-brand-500" aria-hidden />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
