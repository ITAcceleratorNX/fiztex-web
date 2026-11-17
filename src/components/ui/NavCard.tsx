import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cx } from '@/lib/format';

/**
 * Карточка-переход во всю ширину (Figma `КСП / Вход с карточки урока` 2212:7454): значок,
 * название, строка состояния и шеврон. Нажимается вся карточка, поэтому это ссылка, а не
 * кнопка: переход на другой маршрут обязан открываться в новой вкладке средним кликом.
 */
export function NavCard({
  to,
  icon,
  title,
  caption,
  captionIcon,
  className,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  caption: ReactNode;
  /** Значок перед подписью — например, вращающийся загрузчик, пока идёт генерация. */
  captionIcon?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cx(
        'flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition',
        'hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        className,
      )}
    >
      <span className="shrink-0 text-navy-700" aria-hidden="true">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <span className="flex items-center gap-2 text-13 text-slate-600">
          {captionIcon}
          <span className="min-w-0 truncate">{caption}</span>
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
    </Link>
  );
}
