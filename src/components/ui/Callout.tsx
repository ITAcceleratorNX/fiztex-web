import type { ReactNode } from 'react';
import { cx } from '@/lib/format';

/**
 * Подсказка «что делать» с круглым значком (Figma `phyztex` 2460:4758 — «Обратитесь к
 * администратору школы»): серая плашка на радиусе 20, белый круг со значком, заголовок и
 * пояснение. Не тревога и не статус — для них `StatusNotice` и `NoticeBar`.
 */
export function Callout({ icon, title, children, className }: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex gap-3.5 rounded-callout bg-field-filled p-5 text-left', className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-navy-700" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-15 font-semibold leading-tight text-planning-ink">{title}</p>
        {children && <div className="mt-1.5 text-sm leading-relaxed text-planning-muted">{children}</div>}
      </div>
    </div>
  );
}
