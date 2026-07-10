import { NavLink } from 'react-router-dom';
import {
  Home,
  ClipboardList,
  ClipboardCheck,
  Users,
  Heart,
  GraduationCap,
  Calendar,
  BookOpen,
  BookMarked,
  QrCode,
  Sparkles,
  Star,
  Briefcase,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { Logo, FiztexMark } from './Logo';
import { useAuth } from '@/context/AuthContext';
import { cx, initials } from '@/lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Главная', icon: Home },
  { to: '/subjects', label: 'Предметы', icon: BookMarked },
  { to: '/admissions', label: 'Вступительные тесты', icon: ClipboardList },
  { to: '/review', label: 'Проверка ответов', icon: ClipboardCheck },
  { to: '/students', label: 'Ученики', icon: Users },
  { to: '/parents', label: 'Родители', icon: Heart },
  { to: '/teachers', label: 'Учителя', icon: GraduationCap },
  { to: '/schedule', label: 'Расписание', icon: Calendar },
  { to: '/grades', label: 'Дневник и оценки', icon: BookOpen },
  { to: '/attendance', label: 'Посещаемость (QR)', icon: QrCode },
  { to: '/ai-tests', label: 'AI-тесты', icon: Sparkles },
  { to: '/clubs', label: 'Кружки и события', icon: Star },
  { to: '/service', label: 'Сервисные заявки', icon: Briefcase },
];

export function Sidebar() {
  const { admin, logout } = useAuth();

  return (
    <aside className="relative flex w-[264px] shrink-0 flex-col overflow-hidden bg-navy-700">
      {/* Watermark */}
      <FiztexMark className="pointer-events-none absolute -bottom-6 left-1/2 h-56 w-56 -translate-x-1/2 text-white/[0.06]" />

      <div className="px-6 pb-4 pt-7">
        <Logo className="h-10" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
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
                  <Icon className={cx('h-5 w-5 shrink-0', isActive ? 'text-brand-500' : 'text-slate-300/80')} />
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
            <p className="truncate text-sm font-semibold text-white">{admin?.fullName ?? 'Администратор'}</p>
            <p className="truncate text-xs text-slate-400">Администратор</p>
          </div>
          <button
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
