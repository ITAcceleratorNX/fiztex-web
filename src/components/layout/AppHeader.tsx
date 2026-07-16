import { useLocation } from 'react-router-dom';
import { ADMIN_PAGE_TITLES } from '@/platform/labels';

/** Shown for Platform Core routes that don't render their own page title. */
export function AppHeader() {
  const { pathname } = useLocation();
  const title = ADMIN_PAGE_TITLES[pathname];
  if (!title) return null;

  const isAdmin = pathname.startsWith('/admin');

  return (
    <header className="mb-6 flex items-end justify-between gap-4 border-b border-slate-200/80 pb-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          {isAdmin ? 'Platform Core Lite' : 'Учебный процесс'}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      </div>
    </header>
  );
}
