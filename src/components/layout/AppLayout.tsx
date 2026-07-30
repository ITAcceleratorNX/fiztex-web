import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      {/* Фон однотонный #f9fafb — как в макетах. Сетчатый .bg-grid остался
       * только в ученическом флоу (EntranceShell), у него свой дизайн. */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="mx-auto max-w-[1280px] px-8 py-8">
          <AppHeader />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
