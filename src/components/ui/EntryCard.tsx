import type { ReactNode } from 'react';
import { cx } from '@/lib/format';

/**
 * Раздел-карточка с круглым значком (Figma «Материалы урока», 2212:9448 / 2212:9521): название,
 * кто его видит, плашка состояния, строка описания и действия справа. Под шапкой — необязательное
 * содержимое во всю ширину (например, раскрытый выбор учебника).
 */
export function EntryCard({
  icon,
  title,
  meta,
  badge,
  description,
  actions,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  /** Короткое уточнение рядом с названием — «видят ученики в уроке». */
  meta?: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5', className)}>
      <div className="flex items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-info-bg text-navy-700" aria-hidden="true">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-bold text-ink">{title}</span>
            {meta && <span className="text-13 text-planning-muted">{meta}</span>}
            {badge}
          </p>
          {description && <div className="min-w-0 text-sm text-planning-muted">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
