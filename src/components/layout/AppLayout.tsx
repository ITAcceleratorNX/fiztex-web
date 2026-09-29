import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';

export function AppLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const authNotice = (location.state as { authNotice?: unknown } | null)?.authNotice;

  return (
    <div className="fixed inset-0 flex overflow-hidden">
      <Sidebar />
      {/* Фон однотонный #f9fafb — как в макетах. Сетчатый .bg-grid остался
       * только в ученическом флоу (EntranceShell), у него свой дизайн. */}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-gray-50">
        <div className="mx-auto max-w-[1280px] px-8 py-8">
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
