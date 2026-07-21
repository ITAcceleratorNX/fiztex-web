import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { Logo, PhysTechMark } from './Logo';
import { useAuth } from '@/context/AuthContext';
import { cx, initials } from '@/lib/format';
import { NAV_SECTIONS, type NavItem } from './navConfig';

export function Sidebar() {
  const { admin, logout } = useAuth();

  return (
    <aside className="relative flex w-[264px] shrink-0 flex-col overflow-hidden bg-navy-700">
      <PhysTechMark className="pointer-events-none absolute -bottom-6 left-1/2 h-56 w-56 -translate-x-1/2 text-white/[0.06]" />

      <div className="px-6 pb-4 pt-7">
        <Logo className="h-9" />
      </div>

      <nav className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-3 py-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.id}>
            {section.label ? (
              <p className="mb-1 px-3.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {section.label}
              </p>
            ) : null}
            <div className="space-y-2">
              {section.items.map((item) => (
                <SidebarNavItem key={item.to} item={item} />
              ))}
            </div>
          </div>
        ))}
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

function isRouteActive(to: string, end: boolean | undefined, pathname: string): boolean {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Renders one nav item; if it has children, expands them whenever this branch is on-route. */
function SidebarNavItem({ item }: { item: NavItem }) {
  const location = useLocation();
  const children = item.children ?? [];
  const branchActive =
    isRouteActive(item.to, item.end, location.pathname) ||
    children.some((child) => isRouteActive(child.to, child.end, location.pathname));

  return (
    <div>
      <SidebarLink {...item} trailing={children.length > 0 ? <ChevronDown className={cx('h-3.5 w-3.5 shrink-0 transition-transform', branchActive ? '' : '-rotate-90 opacity-60')} /> : undefined} />
      {children.length > 0 && branchActive && (
        <div className="mt-1 space-y-1 rounded-xl bg-white/5 py-1.5 pl-2 pr-1">
          {children.map((child) => (
            <SidebarLink key={child.to} {...child} compact />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  end,
  noApi,
  trailing,
  compact,
}: NavItem & { trailing?: ReactNode; compact?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          'group relative flex items-center gap-3 rounded-xl border-l-[3px] py-2.5 pr-3.5 text-sm font-medium transition',
          compact ? 'pl-2.5' : 'pl-3',
          isActive
            ? 'border-brand-500 bg-white font-semibold text-navy-700'
            : 'border-transparent text-slate-300/90 hover:bg-white/10 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cx(compact ? 'h-4 w-4' : 'h-5 w-5', 'shrink-0', isActive ? 'text-navy-700' : 'text-slate-300/80')}
          />
          <span className="truncate">{label}</span>
          {noApi ? (
            <span
              className={cx(
                'ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                isActive ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-slate-400',
              )}
            >
              нет API
            </span>
          ) : null}
          {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
        </>
      )}
    </NavLink>
  );
}
