import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="bg-grid flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-8 py-8">
          <AppHeader />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
