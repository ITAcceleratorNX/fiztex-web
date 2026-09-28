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
};

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
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
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
    }),
    [current, isControlled, onValueChange, baseId],
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cx(
        'flex gap-1 border-b border-slate-200',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const { value: active, setValue, baseId } = useTabsContext('TabsTrigger');
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

  // Only the selected panel is mounted, so inactive tabs must not reference missing IDs.
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
        '-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-brand-500 text-brand-700'
          : 'border-transparent text-slate-500 hover:text-slate-800',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: active, baseId } = useTabsContext('TabsContent');
  if (active !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
