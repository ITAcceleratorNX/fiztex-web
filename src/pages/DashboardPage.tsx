import { Link } from 'react-router-dom';
import {
  ClipboardList,
  BookMarked,
  ArrowRight,
  Sparkles,
  Users,
  School,
  CalendarRange,
  CalendarDays,
  CalendarClock,
  KeyRound,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApplicants, useSubjects, useTests } from '@/hooks/queries';
import { StatCard } from '@/components/ui/StatCard';

const PLATFORM_LINKS: { to: string; label: string; hint: string; icon: LucideIcon }[] = [
  { to: '/admin/users', label: 'Пользователи', hint: 'Роли, статусы, связи', icon: Users },
  { to: '/admin/classes', label: 'Классы', hint: 'Привязка к учебному году', icon: School },
  {
    to: '/admin/academic-year',
    label: 'Учебный год',
    hint: 'Черновик / активный / архив',
    icon: CalendarRange,
  },
  { to: '/admin/periods', label: 'Учебные периоды', hint: 'Четверти и триместры', icon: CalendarDays },
  {
    to: '/admin/schedule-settings',
    label: 'Настройки расписания',
    hint: 'Звонки, рабочие дни, календарь',
    icon: CalendarClock,
  },
  { to: '/admin/access-codes', label: 'Доступы / коды', hint: 'PIN и коды активации', icon: KeyRound },
  { to: '/admin/import', label: 'Импорт', hint: 'Excel-заготовка', icon: Upload },
];

function LinkCard({
  to,
  label,
  hint,
  icon: Icon,
  accent = 'brand',
}: {
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  accent?: 'brand' | 'violet';
}) {
  const iconBg = accent === 'violet' ? 'bg-violet-50 text-violet-500' : 'bg-brand-50 text-brand-500';

  return (
    <Link
      to={to}
      className="card flex items-center justify-between px-6 py-5 transition hover:ring-brand-200"
    >
      <div className="flex items-center gap-4">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-slate-800">{label}</p>
          <p className="text-sm text-slate-500">{hint}</p>
        </div>
      </div>
      <ArrowRight className="h-5 w-5 text-slate-400" />
    </Link>
  );
}

export function DashboardPage() {
  const { admin } = useAuth();
  const subjects = useSubjects();
  const tests = useTests(false);
  const aiTests = useTests(true);
  const applicants = useApplicants();

  const activeAdmissionTests = tests.data?.filter((t) => t.status === 'ACTIVE').length ?? 0;
  const activeAiTests = aiTests.data?.filter((t) => t.status === 'ACTIVE').length ?? 0;

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
        Здравствуйте, {admin?.fullName?.split(' ')[0] ?? 'Администратор'}
      </h1>
      <p className="mt-1 text-slate-500">Обзор системы Fiztex — Platform Core и учебные модули.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Предметов" value={subjects.data?.length ?? '—'} />
        <StatCard label="AI-тестов (активных)" value={activeAiTests || '—'} />
        <StatCard label="Поступающих" value={applicants.data?.length ?? '—'} />
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
        Platform Core
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORM_LINKS.map((link) => (
          <LinkCard key={link.to} {...link} />
        ))}
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
        Учебный процесс и приём
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <LinkCard to="/subjects" label="Предметы" hint="Справочник предметов для тестов" icon={BookMarked} />
        <LinkCard
          to="/admissions"
          label="Вступительные тесты"
          hint={
            activeAdmissionTests > 0
              ? `${activeAdmissionTests} активных`
              : 'Поступающие и назначения'
          }
          icon={ClipboardList}
        />
        <LinkCard
          to="/ai-tests"
          label="AI-тесты"
          hint="Материалы, генерация и ревью вопросов"
          icon={Sparkles}
          accent="violet"
        />
      </div>
    </div>
  );
}
