import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { Logo, PhysTechMark } from './Logo';
import { useAuth } from '@/context/AuthContext';
import { cx, initials } from '@/lib/format';
import { NAV_SECTIONS, type NavItem } from './navConfig';

export function Sidebar() {
  const { admin, logout } = useAuth();

  return (
    <aside className="relative flex w-[220px] shrink-0 flex-col overflow-hidden bg-navy-700">
      <PhysTechMark className="pointer-events-none absolute -bottom-4 left-1/2 h-52 w-52 -translate-x-1/2 text-white/[0.07]" />

      <div className="flex items-center justify-center px-6 pb-6 pt-12">
        <Logo className="h-9 w-auto" />
      </div>

      <nav className="no-scrollbar relative z-10 flex-1 space-y-5 overflow-y-auto pb-4 pt-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.id}>
            {section.label ? (
              <p className="mb-1.5 px-7 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                {section.label}
              </p>
            ) : null}
            <div>
              {section.items.map((item) => (
                <SidebarNavItem key={item.to} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="relative z-10 px-4 pb-6">
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/10 px-4 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-xs font-bold text-white">
            {admin ? initials(admin.fullName) : 'A'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">
              {admin?.fullName ?? 'Администратор'}
            </p>
            <p className="truncate text-[11px] text-white/60">Администратор</p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Выйти"
            className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
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

/** Renders one nav item; expands children when this branch is on-route. */
function SidebarNavItem({ item }: { item: NavItem }) {
  const location = useLocation();
  const children = item.children ?? [];
  const selfActive = isRouteActive(item.to, item.end, location.pathname);
  const childActive = children.some((child) =>
    isRouteActive(child.to, child.end, location.pathname),
  );
  const branchOpen = selfActive || childActive;

  if (children.length === 0) {
    return <TopLevelLink item={item} />;
  }

  return (
    <div
      className={cx(
        branchOpen && 'overflow-hidden rounded-tl-[24px] rounded-bl-[24px] bg-white/45',
      )}
    >
      <NavLink
        to={item.to}
        end={item.end}
        className={cx(
          'flex h-[52px] items-center gap-3 pl-7 pr-3 text-sm transition',
          branchOpen
            ? cx(
                'font-semibold text-navy-700',
                selfActive && !childActive ? 'bg-white rounded-tl-[24px]' : 'bg-transparent',
              )
            : 'font-normal text-white/45 hover:text-white/80',
        )}
      >
        <item.icon
          className={cx('size-[18px] shrink-0', branchOpen ? 'text-navy-700' : 'text-white/45')}
        />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <ChevronDown
          className={cx(
            'size-5 shrink-0 transition-transform',
            branchOpen ? 'text-navy-700' : 'text-white/45 -rotate-90',
          )}
        />
      </NavLink>

      {branchOpen &&
        children.map((child, index) => (
          <ChildLink
            key={child.to}
            item={child}
            isLast={index === children.length - 1}
          />
        ))}
    </div>
  );
}

function TopLevelLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx(
          'flex h-12 items-center gap-3 pl-6 pr-3 text-sm transition',
          isActive
            ? 'rounded-tl-[24px] rounded-bl-[24px] bg-white font-semibold text-navy-700'
            : 'font-normal text-white/45 hover:text-white/80',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cx('size-5 shrink-0', isActive ? 'text-navy-700' : 'text-white/45')} />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.noApi ? (
            <span
              className={cx(
                'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                isActive ? 'bg-navy-50 text-navy-500' : 'bg-white/10 text-white/40',
              )}
            >
              нет API
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

function ChildLink({ item, isLast }: { item: NavItem; isLast: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx(
          'flex h-[52px] items-center gap-3 pl-7 pr-3 text-sm transition',
          isActive
            ? cx('bg-white font-semibold text-navy-700', isLast && 'rounded-bl-[24px]')
            : 'font-normal text-navy-700/80 hover:bg-white/40 hover:text-navy-700',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cx('size-[18px] shrink-0', isActive ? 'text-navy-700' : 'text-navy-700/70')}
          />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.noApi ? (
            <span className="shrink-0 rounded bg-navy-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-navy-500">
              нет API
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}
