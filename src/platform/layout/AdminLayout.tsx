import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

export function AdminLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <main className="bg-grid flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-8 py-8">
          <AdminHeader />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
