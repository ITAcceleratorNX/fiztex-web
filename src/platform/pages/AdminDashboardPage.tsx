import { Link } from 'react-router-dom';
import {
  Users,
  School,
  CalendarRange,
  CalendarDays,
  KeyRound,
  Upload,
  type LucideIcon,
} from 'lucide-react';

const LINKS: { to: string; label: string; hint: string; icon: LucideIcon }[] = [
  { to: '/admin/users', label: 'Пользователи', hint: 'Роли, статусы, связи', icon: Users },
  { to: '/admin/classes', label: 'Классы', hint: 'Привязка к учебному году', icon: School },
  { to: '/admin/academic-year', label: 'Учебный год', hint: 'Черновик / активный / архив', icon: CalendarRange },
  { to: '/admin/periods', label: 'Учебные периоды', hint: 'Четверти и триместры', icon: CalendarDays },
  { to: '/admin/access-codes', label: 'Доступы / коды', hint: 'PIN и коды активации', icon: KeyRound },
  { to: '/admin/import', label: 'Импорт', hint: 'Excel-заготовка', icon: Upload },
];

export function AdminDashboardPage() {
  return (
    <div>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Каркас админки Platform Core Lite (PHYCORE-003). Данные пока mock — страницы готовы к
        подключению API из PHYCORE-001 и PHYCORE-002.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map(({ to, label, hint, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="card flex items-start gap-3 p-4 transition hover:ring-brand-500/30"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-700/5 text-navy-700">
              <Icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-900">{label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
