import { cx } from '@/lib/format';

/**
 * Полоса прогресса «11/24 заполнено» (Figma `progress-track` / `progress-fill`, 2162:2097).
 *
 * <p>Только полоса: число рядом пишет экран своими словами — у разных разделов оно значит
 * разное («заполнено», «отмечено»), а у полосы смысл один.
 */
export function ProgressBar({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  /** Имя для скринридера: сама полоса текста не несёт. */
  label: string;
  /** Ширина полосы: `w-56` и т. п. */
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cx('h-1.5 overflow-hidden rounded-full bg-slate-100', className)}
    >
      <div
        className="h-full rounded-full bg-success-border transition-[width] duration-300"
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
