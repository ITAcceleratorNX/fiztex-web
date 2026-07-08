import { avatarColor, cx, initials } from '@/lib/format';

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const { bg, fg } = avatarColor(name);
  const dim = size === 'lg' ? 'h-11 w-11 text-base' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', dim)}
      style={{ backgroundColor: bg, color: fg }}
    >
      {initials(name)}
    </span>
  );
}
