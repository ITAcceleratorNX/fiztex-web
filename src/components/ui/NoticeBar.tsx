import type { ReactNode } from 'react';
import { cx } from '@/lib/format';

type Tone = 'solid' | 'soft';

/**
 * Полоса-уведомление над содержимым (Figma 2067:10093 — «период закрыт»,
 * 2067:10233 — «замена»).
 *
 * Два тона, потому что в макете у них разный вес: `solid` — запрет, он должен
 * читаться раньше самой карточки; `soft` — факт о уроке, он часть карточки.
 */
export function NoticeBar({
  tone = 'soft',
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const solid = tone === 'solid';
  return (
    <div
      className={cx(
        'flex w-full items-center gap-3 rounded-xl border',
        solid
          ? 'border-brand-500 bg-brand-500 p-4 text-15 font-bold text-white'
          : 'border-brand-200 bg-brand-500/10 px-4 py-3 text-13 font-semibold text-slate-900',
        className,
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
