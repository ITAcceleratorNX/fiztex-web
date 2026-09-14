import type { ReactNode } from 'react';
import { cx } from '@/lib/format';

type Tone = 'solid' | 'soft' | 'warning';

const TONES: Record<Tone, string> = {
  solid: 'items-center border-brand-500 bg-brand-500 p-4 text-15 font-bold text-white',
  soft: 'items-center border-brand-200 bg-brand-500/10 px-4 py-3 text-13 font-semibold text-slate-900',
  warning: 'items-start border-brand-400 bg-amber-50 px-3.5 py-2.5 text-13 text-amber-800',
};

/**
 * Полоса-уведомление над содержимым (Figma 2067:10093 — «период закрыт»,
 * 2067:10233 — «замена», 2149:3587 — «такой файл уже есть»).
 *
 * Тона различаются весом: `solid` — запрет, он должен читаться раньше самой карточки;
 * `soft` — факт об уроке, он часть карточки; `warning` — предупреждение внутри формы,
 * под которым обычно стоит действие, поэтому текст в нём обычного начертания и значок
 * держится первой строки.
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
  return (
    <div className={cx('flex w-full gap-3 rounded-xl border', TONES[tone], className)}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
