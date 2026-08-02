import { cx } from '@/lib/format';

/**
 * Пометка «Изменено» рядом с полем, которое разошлось с расписанием
 * (Figma 2067:10215, 2067:10227).
 *
 * Стоит вплотную к значению, поэтому мельче и жирнее статуса: 11px Bold,
 * контурный оранжевый, радиус 6.
 */
export function ChangedChip({ title, className }: { title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5',
        'text-11 font-bold text-brand-500',
        className,
      )}
    >
      Изменено
    </span>
  );
}
