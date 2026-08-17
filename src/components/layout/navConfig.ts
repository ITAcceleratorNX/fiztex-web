import {
  Home,
  Users,
  School,
  CalendarRange,
  CalendarDays,
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
  /** Nested items shown when this item or one of its children is on the current route. */
  children?: NavItem[];
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

/** Single sidebar for Platform Core + admissions admin. */
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
      { to: '/homework', label: 'Домашние задания', icon: BookOpenCheck },
      { to: '/grades', label: 'Дневник и оценки', icon: BookOpen, noApi: true },
      { to: '/attendance', label: 'Посещаемость (QR)', icon: QrCode, noApi: true },
      { to: '/ai-tests', label: 'AI-тесты', icon: Sparkles },
      { to: '/clubs', label: 'Кружки и события', icon: Star, noApi: true },
      { to: '/service', label: 'Сервисные заявки', icon: Briefcase, noApi: true },
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
