import {
  Home,
  Users,
  School,
  CalendarRange,
  CalendarDays,
  Clock,
  Clock3,
  BookText,
  KeyRound,
  Upload,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Heart,
  Calendar,
  BookOpen,
  BookOpenCheck,
  QrCode,
  Sparkles,
  Star,
  Briefcase,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from '@/lib/routes';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Shown when route has no backend yet */
  noApi?: boolean;
  /**
   * Пункт-действие, а не раздел: залит фирменным оранжевым независимо от того, где
   * пользователь сейчас (Figma `sidebar-tekushchiy-urok`). Нужен «Текущему уроку» —
   * он никуда не приводит сам, а сразу уводит на карточку урока, поэтому подсветки
   * «вы здесь» у него не бывает в принципе.
   */
  accent?: boolean;
  /** Nested items shown when this item or one of its children is on the current route. */
  children?: NavItem[];
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

/** Sidebar for Platform Core + admissions admin. Для учителя см. {@link navSectionsForRole}. */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'home',
    label: '',
    // `/` — публичный раздел анонсов, домашний экран администратора живёт на `/dashboard`.
    items: [{ to: ROUTES.dashboard, label: 'Главная', icon: Home, end: true }],
  },
  {
    id: 'platform',
    label: 'Platform Core',
    items: [
      {
        to: '/admin/users',
        label: 'Пользователи',
        icon: Users,
        children: [
          { to: '/students', label: 'Ученики', icon: Users },
          { to: '/parents', label: 'Родители', icon: Heart },
          { to: '/teachers', label: 'Учителя', icon: GraduationCap },
        ],
      },
      { to: '/admin/classes', label: 'Классы', icon: School },
      { to: '/admin/academic-year', label: 'Учебный год', icon: CalendarRange },
      { to: '/admin/periods', label: 'Учебные периоды', icon: CalendarDays },
      { to: '/admin/school-subjects', label: 'Школьные предметы', icon: BookText },
      { to: '/admin/access-codes', label: 'Доступы / коды', icon: KeyRound },
      { to: '/admin/import', label: 'Импорт', icon: Upload },
    ],
  },
  {
    id: 'school',
    label: 'Учебный процесс',
    items: [
      { to: '/lesson-schedule', label: 'Расписание', icon: Calendar },
      { to: ROUTES.journal, label: 'Журнал оценок', icon: BookOpen },
      { to: ROUTES.attendance, label: 'Посещаемость', icon: QrCode },
      { to: '/ai-tests', label: 'AI-тесты', icon: Sparkles },
      { to: '/clubs', label: 'Кружки и события', icon: Star, noApi: true },
      { to: ROUTES.serviceRequests, label: 'Сервисные заявки', icon: Briefcase },
    ],
  },
  {
    id: 'admissions',
    label: 'Приём',
    items: [
      { to: '/admissions', label: 'Вступительные тесты', icon: ClipboardList },
      { to: '/results', label: 'Результаты', icon: FileCheck2 },
    ],
  },
];

/**
 * Меню учителя (ТЗ HOMEWORK-005.1 §3).
 *
 * Пунктов ровно столько, сколько разделов реально работает под учителем. Остальное в
 * панели читает `/api/admin/*`, а учительскому токену это 401, который общий `request()`
 * считает концом сессии: пункт меню, выбрасывающий на форму входа, хуже отсутствующего.
 *
 * «Расписание» здесь — не админский конструктор, а свой экран поверх ролевого
 * `/api/schedule/me/week`: из него учитель открывает урок, а из урока — его задания.
 */
export const TEACHER_NAV_SECTIONS: NavSection[] = [
  {
    id: 'teaching',
    label: '',
    items: [
      // Первым пунктом и отдельным цветом (Figma `sidebar-tekushchiy-urok-inactive`
      // и `…-open`): это кнопка «отведи меня к работе», а не ещё один раздел, и
      // искать её среди разделов учителю пришлось бы каждый урок.
      { to: ROUTES.currentLesson, label: 'Текущий урок', icon: Clock3, accent: true },
      { to: ROUTES.mySchedule, label: 'Расписание', icon: Calendar },
      { to: ROUTES.myAvailability, label: 'Моё рабочее время', icon: Clock },
      { to: ROUTES.journal, label: 'Журнал оценок', icon: BookOpen },
      { to: ROUTES.homework, label: 'Домашние задания', icon: BookOpenCheck },
      // Заявки — не учебный раздел, но автор у них тот же (SERVICE-FE-001 §1), и читает
      // он свой `/api/service-requests/my`, а не `/api/admin/*`: учителю сюда можно.
      { to: ROUTES.serviceRequests, label: 'Сервисные заявки', icon: Briefcase },
    ],
  },
];

/**
 * Пункт «Сотрудники» внутри «Пользователей» — только Super Admin (SERVICE-FE-004 §3).
 *
 * Ветка собирается здесь, а не объявляется в `NAV_SECTIONS`, потому что зависит от роли:
 * держать её в общем списке и прятать при отрисовке значило бы разложить одно правило по
 * двум местам — меню и `isRouteAllowedForRole`.
 */
const EMPLOYEES_NAV_ITEM: NavItem = { to: ROUTES.employees, label: 'Сотрудники', icon: Wrench };

export function navSectionsForRole(role: string | undefined): NavSection[] {
  if (role === 'TEACHER') return TEACHER_NAV_SECTIONS;
  if (role !== 'SUPER_ADMIN') return NAV_SECTIONS;

  return NAV_SECTIONS.map((section) =>
    section.id === 'platform'
      ? {
          ...section,
          items: section.items.map((item) =>
            item.to === '/admin/users'
              ? { ...item, children: [...(item.children ?? []), EMPLOYEES_NAV_ITEM] }
              : item,
          ),
        }
      : section,
  );
}
