import type { ReactNode } from 'react';
import { PhysTechMark } from '@/components/layout/Logo';
import { cx } from '@/lib/format';
import { APP_NAME } from '@/lib/branding';

/**
 * Minimal branded shell for the applicant flow. Deliberately simple (per TЗ section 2 — final
 * visuals will be drawn by a designer later) but responsive for mobile/tablet/desktop.
 */
export function EntranceShell({
  children,
  size = 'md',
}: {
  children: ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <div className="min-h-screen bg-grid">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-700 text-white">
            <PhysTechMark className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-navy-800">{APP_NAME}</p>
            <p className="text-xs text-slate-500">Вступительное тестирование</p>
          </div>
        </div>
      </header>
      <main className={cx('mx-auto w-full px-4 py-8 sm:py-10', size === 'lg' ? 'max-w-3xl' : 'max-w-md')}>
        {children}
      </main>
    </div>
  );
}
