import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cx } from '@/lib/format';

/**
 * Карточка со сворачиваемым содержимым (Figma 2067:10294 «История изменений»).
 *
 * Шапка — единственная кликабельная зона, поэтому она и есть кнопка: так состояние
 * доступно с клавиатуры и озвучивается скринридером без ARIA-надстроек поверх div.
 */
export function CollapsibleCard({
  title,
  icon,
  defaultOpen = false,
  disabled = false,
  children,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const expanded = open && !disabled;

  return (
    <section className={cx('rounded-2xl border border-slate-200 bg-white p-6 shadow-raised', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-3 text-left disabled:cursor-default"
      >
        <span className="flex min-w-0 items-center gap-2 text-base font-bold text-slate-900">
          {icon}
          <span className="truncate">{title}</span>
        </span>
        {!disabled &&
          (expanded ? (
            <ChevronUp className="size-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-slate-400" />
          ))}
      </button>
      {expanded && (
        <div id={contentId} className="mt-4">
          {children}
        </div>
      )}
    </section>
  );
}
