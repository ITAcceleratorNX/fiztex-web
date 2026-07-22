import { useEffect, useRef } from 'react';
import {
  ChevronRight,
  FileSpreadsheet,
  GraduationCap,
  Monitor,
  Shield,
  Users,
} from 'lucide-react';
import { cx } from '@/lib/format';
import type { AccountRole } from '../types';

export type CreateUserMenuAction = AccountRole | 'IMPORT';

const ROLE_ITEMS: {
  action: CreateUserMenuAction;
  label: string;
  icon: typeof GraduationCap;
  iconClass: string;
  hoverClass: string;
}[] = [
  {
    action: 'STUDENT',
    label: 'Ученик',
    icon: GraduationCap,
    iconClass: 'text-sky-600',
    hoverClass: 'hover:bg-sky-50 hover:text-sky-700',
  },
  {
    action: 'PARENT',
    label: 'Родитель',
    icon: Users,
    iconClass: 'text-orange-500',
    hoverClass: 'hover:bg-orange-50 hover:text-orange-700',
  },
  {
    action: 'TEACHER',
    label: 'Учитель',
    icon: Monitor,
    iconClass: 'text-violet-600',
    hoverClass: 'hover:bg-violet-50 hover:text-violet-700',
  },
  {
    action: 'ADMIN',
    label: 'Администратор',
    icon: Shield,
    iconClass: 'text-slate-600',
    hoverClass: 'hover:bg-slate-100 hover:text-slate-800',
  },
];

export function CreateUserMenu({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (action: CreateUserMenuAction) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Создать пользователя"
      className="absolute right-0 top-full z-30 mt-2 w-[280px] overflow-hidden rounded-2xl bg-white py-3 shadow-pop ring-1 ring-slate-200/80 animate-scale-in"
    >
      <div className="px-4 pb-3 pt-1">
        <p className="text-base font-bold text-slate-900">Создать пользователя</p>
        <p className="mt-0.5 text-sm text-slate-500">Выберите роль нового пользователя</p>
      </div>

      <div className="space-y-1 px-2 pb-1">
        {ROLE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.action}
              type="button"
              role="menuitem"
              onClick={() => {
                onSelect(item.action);
                onClose();
              }}
              className={cx(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition',
                item.hoverClass,
              )}
            >
              <Icon className={cx('h-5 w-5 shrink-0', item.iconClass)} />
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </button>
          );
        })}
      </div>

      <div className="mx-4 my-2 border-t border-slate-100" />

      <div className="px-2 pb-1">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onSelect('IMPORT');
            onClose();
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
        >
          <FileSpreadsheet className="h-5 w-5 shrink-0 text-sky-500" />
          <span className="flex-1">Импорт из Excel</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
        </button>
      </div>
    </div>
  );
}
