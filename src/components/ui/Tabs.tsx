import {
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cx } from '@/lib/format';
import { handleRovingFocusKeyDown } from './rovingFocus';

type TabsContextValue = {
  value: string;
  setValue: (next: string) => void;
  baseId: string;
  variant: TabsVariant;
};

/**
 * - `default` — оранжевая черта бренда;
 * - `pills` — плашки на серой дорожке;
 * - `navy` — разделы страницы под шапкой (Figma `phyztex` 2460:1845 «Коды и PIN / Заявки на
 *   доступ»): кегль 15, шаг 28, активная вкладка — фирменный navy с чертой 2 px.
 */
export type TabsVariant = 'default' | 'pills' | 'navy';

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error(`${component} must be used within <Tabs>`);
  }
  return ctx;
}

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  className,
  variant = 'default',
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
  variant?: TabsVariant;
}) {
  const baseId = useId();
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? '');
  const isControlled = value !== undefined;
  const current = isControlled ? value : uncontrolled;

  const ctx = useMemo<TabsContextValue>(
    () => ({
      value: current,
      setValue: (next) => {
        if (!isControlled) setUncontrolled(next);
        onValueChange?.(next);
      },
      baseId,
      variant,
    }),
    [current, isControlled, onValueChange, baseId, variant],
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  const { variant } = useTabsContext('TabsList');
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cx(
        variant === 'pills'
          ? 'inline-flex flex-wrap gap-1.5 rounded-lg bg-neutral-bg p-1'
          : variant === 'navy'
            ? 'flex gap-7 border-b border-line'
            : 'flex gap-1 border-b border-slate-200',
        className,
      )}
    >
      {children}
    </div>
  );
}

const TRIGGER_BASE: Record<TabsVariant, string> = {
  default: '-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 disabled:cursor-not-allowed disabled:opacity-50',
  pills: 'rounded-md px-3.5 py-1.5 text-13 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 disabled:cursor-not-allowed disabled:opacity-50',
  navy: '-mb-px inline-flex items-center gap-2 border-b-2 px-0.5 pb-3 text-15 leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 disabled:cursor-not-allowed disabled:opacity-50',
};

const TRIGGER_STATE: Record<TabsVariant, { on: string; off: string }> = {
  default: { on: 'border-brand-500 text-brand-700', off: 'border-transparent text-slate-500 hover:text-slate-800' },
  pills: { on: 'bg-navy-700 text-white', off: 'text-muted hover:text-ink' },
  navy: { on: 'border-navy-700 font-semibold text-navy-700', off: 'border-transparent font-medium text-slate-600 hover:text-navy-700' },
};

export function TabsTrigger({
  value,
  children,
  className,
  onClick,
  count,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
  /**
   * Счётчик рядом с подписью — то, что ждёт работы на вкладке. Ноль не рисуется: пустой
   * кружок звал бы туда, где делать нечего.
   */
  count?: number;
}) {
  const { value: active, setValue, baseId, variant } = useTabsContext('TabsTrigger');
  const selected = active === value;
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    rest.onKeyDown?.(event);
    if (!event.defaultPrevented) {
      handleRovingFocusKeyDown(event, {
        itemSelector: '[role="tab"]:not(:disabled)',
        activateOnArrow: true,
      });
    }
  };

  // Inactive panels may be unmounted, so their tabs must not reference missing IDs.
  return (
    <button
      type="button"
      role="tab"
      {...rest}
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={selected ? `${baseId}-panel-${value}` : undefined}
      tabIndex={selected && !rest.disabled ? 0 : -1}
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setValue(value);
      }}
      className={cx(
        TRIGGER_BASE[variant],
        selected ? TRIGGER_STATE[variant].on : TRIGGER_STATE[variant].off,
        count != null && count > 0 && variant !== 'navy' && 'inline-flex items-center gap-2',
        className,
      )}
    >
      {children}
      {/* Пробел — для имени вкладки («Заявки на доступ 6»); во flex-строке он не рисуется. */}
      {count != null && count > 0 && ' '}
      {count != null && count > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-xs font-bold leading-none text-white">
          {count}
        </span>
      )}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
  forceMount = false,
}: {
  value: string;
  children: ReactNode;
  className?: string;
  /** Preserve editor drafts and DOM integrations while hiding an inactive panel. */
  forceMount?: boolean;
}) {
  const { value: active, baseId } = useTabsContext('TabsContent');
  if (active !== value && !forceMount) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      hidden={active !== value}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
