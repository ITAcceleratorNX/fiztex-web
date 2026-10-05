import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '@/lib/format';

const accents = {
  orange: { band: 'bg-brand-500/60', icon: 'bg-brand-500' },
  navy: { band: 'bg-navy-400/60', icon: 'bg-navy-700' },
  teal: { band: 'bg-teal-500/60', icon: 'bg-teal-500' },
} as const;

/** Плитка раздела рабочего пространства (Figma 2185:3389). */
export function WorkspaceSectionCard({
  to, title, description, icon, tone,
}: {
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
  tone: keyof typeof accents;
}) {
  const accent = accents[tone];
  return (
    <Link
      to={to}
      className="relative flex min-h-40 min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-soft transition hover:border-navy-400 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 motion-reduce:transition-none"
    >
      <span className={cx('absolute inset-x-0 top-0 h-14', accent.band)} aria-hidden="true" />
      <span className={cx('relative mt-1 flex size-14 items-center justify-center rounded-2xl text-white', accent.icon)} aria-hidden="true">
        {icon}
      </span>
      <span className="relative mt-4 break-words text-base font-bold leading-snug text-ink">{title}</span>
      <span className="relative mt-1 text-13 leading-relaxed text-muted">{description}</span>
    </Link>
  );
}
