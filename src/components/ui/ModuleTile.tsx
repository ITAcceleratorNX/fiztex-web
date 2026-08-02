import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cx } from '@/lib/format';

export type ModuleTileTone = 'teal' | 'orange' | 'violet' | 'blue';

/** Подложки иконок из макета (2067:10256, 10266, 10276, 10286). */
const tones: Record<ModuleTileTone, string> = {
  teal: 'bg-teal-50 text-teal-600',
  orange: 'bg-brand-50 text-brand-600',
  violet: 'bg-violet-50 text-violet-600',
  blue: 'bg-info-bg text-link',
};

/**
 * Плитка перехода в модуль урока (Figma 2067:10254).
 *
 * `disabled` — не украшение: плитка остаётся на месте, но не притворяется ссылкой,
 * пока за ней нет модуля. Так композиция макета сохраняется, а пользователь не
 * упирается в неработающий переход.
 */
export function ModuleTile({
  icon,
  tone = 'teal',
  title,
  value,
  onClick,
  disabled = false,
}: {
  icon: ReactNode;
  tone?: ModuleTileTone;
  title: string;
  value: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={cx(
        'flex flex-1 flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-tile transition',
        disabled ? 'cursor-default opacity-60' : 'hover:border-brand-300 hover:shadow-soft',
      )}
    >
      <span className="flex w-full items-center justify-between">
        <span
          className={cx(
            'flex size-9 items-center justify-center rounded-full',
            disabled ? 'bg-slate-100 text-slate-400' : tones[tone],
          )}
        >
          {icon}
        </span>
        {!disabled && <ChevronRight className="size-4 shrink-0 text-slate-400" />}
      </span>
      <span className="flex w-full min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-semibold text-slate-900">{title}</span>
        <span className="truncate text-13 text-slate-600">{value}</span>
      </span>
    </button>
  );
}
