import { avatarColor, cx, initials } from '@/lib/format';

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
  variant?: 'default' | 'navy';
}) {
  const { bg, fg } = color ?? avatarColor(name);
  const dim = size === 'lg' ? 'h-11 w-11 text-base' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', dim, variant === 'navy' && 'bg-navy-700 text-white')}
      style={variant === 'default' ? { backgroundColor: bg, color: fg } : undefined}
    >
      {initials(name)}
    </span>
  );
}
