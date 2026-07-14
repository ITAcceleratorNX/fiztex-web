import { NavLink } from 'react-router-dom';
import {
  Home,
  Users,
  School,
  CalendarRange,
  CalendarDays,
  KeyRound,
  Upload,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { Logo, FiztexMark } from '@/components/layout/Logo';
import { useAuth } from '@/context/AuthContext';
import { cx, initials } from '@/lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/admin', label: 'Главная', icon: Home, end: true },
  { to: '/admin/users', label: 'Пользователи', icon: Users },
  { to: '/admin/classes', label: 'Классы', icon: School },
  { to: '/admin/academic-year', label: 'Учебный год', icon: CalendarRange },
  { to: '/admin/periods', label: 'Учебные периоды', icon: CalendarDays },
  { to: '/admin/access-codes', label: 'Доступы / коды', icon: KeyRound },
  { to: '/admin/import', label: 'Импорт', icon: Upload },
];

export function AdminSidebar() {
  const { admin, logout } = useAuth();

  return (
    <aside className="relative flex w-[264px] shrink-0 flex-col overflow-hidden bg-navy-700">
      <FiztexMark className="pointer-events-none absolute -bottom-6 left-1/2 h-56 w-56 -translate-x-1/2 text-white/[0.06]" />

      <div className="px-6 pb-3 pt-7">
        <Logo className="h-10" />
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300/90">
          Platform Core
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-white text-navy-700 shadow-sm'
                    : 'text-slate-300/90 hover:bg-white/10 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cx('h-5 w-5 shrink-0', isActive ? 'text-brand-500' : 'text-slate-300/80')}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="relative border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
            {admin ? initials(admin.fullName) : 'A'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {admin?.fullName ?? 'Администратор'}
            </p>
            <p className="truncate text-xs text-slate-400">Администратор</p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Выйти"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
