import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';
import { cx } from '@/lib/format';

export function AppLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const planning = location.pathname.startsWith('/workspace/ktp');
  const planningParams = new URLSearchParams(location.search);
  const planningDetail = /\/ktp\/(drafts|bindings)\//.test(location.pathname) && planningParams.get('progress') !== 'initial' && !planningParams.has('confirmed');
  const authNotice = (location.state as { authNotice?: unknown } | null)?.authNotice;

  return (
    <div className="fixed inset-0 flex overflow-hidden">
      <Sidebar />
      <main className={cx('min-h-0 min-w-0 flex-1 overflow-y-auto', planning ? planningDetail ? 'bg-planning-canvas' : 'bg-surface' : 'bg-canvas')}>
        <div className={cx('mx-auto max-w-[1280px] px-4 py-6 sm:px-6', planning ? 'lg:px-10 lg:py-9' : 'lg:px-8 lg:py-8')}>
          <AppHeader />
          {typeof authNotice === 'string' && (
            <p role="status" className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              {authNotice}
            </p>
          )}
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}
