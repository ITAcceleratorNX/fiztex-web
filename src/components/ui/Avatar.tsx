import { avatarColor, cx, initials } from '@/lib/format';

const VARIANTS = {
  default: '',
  navy: 'bg-navy-700 text-white',
  'navy-soft': 'bg-navy-50 text-navy-700',
  amber: 'bg-amber-600 text-white',
  violet: 'bg-violet-600 text-white',
  green: 'bg-green-600 text-white',
} as const;

/** Цвета аватаров списка людей по порядку — соседние строки не сливаются. */
export const AVATAR_SEQUENCE = ['amber', 'violet', 'navy', 'green'] as const;

export function Avatar({
  name,
  size = 'md',
  color,
  variant = 'default',
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /** Override the name-derived color, e.g. to color-code by role. */
  color?: { bg: string; fg: string };
  /**
   * `navy` — белые инициалы на фирменном синем; `navy-soft` — синие на бледно-синем.
   * Пара различает «лучшее совпадение» и остальные в списке похожих профилей (2460:2129).
   * `amber`, `violet`, `green` — белые инициалы на своём цвете: в списке родителей и детей
   * карточки (Figma `phyztex` 2243:30240, 2243:30541) люди различаются цветом по порядку.
   */
  variant?: 'default' | 'navy' | 'navy-soft' | 'amber' | 'violet' | 'green';
}) {
  const { bg, fg } = color ?? avatarColor(name);
  const dim = size === 'lg' ? 'h-11 w-11 text-base' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', dim, VARIANTS[variant])}
      style={variant === 'default' ? { backgroundColor: bg, color: fg } : undefined}
    >
      {initials(name)}
    </span>
  );
}
