import { Check } from 'lucide-react';
import { cx } from '@/lib/format';

/**
 * Плашка «СОР 1» / «✓ СОР 1» в клетке расписания (Figma `phyztex` D1): запланированная работа —
 * заливка navy, проведённая — светлая с галочкой. Статус приходит с сервера и от даты урока не зависит.
 * `needsReschedule` красит рамку: уроку нужен новый день.
 */
export function AssessmentBadge({
  title,
  conducted,
  needsReschedule,
}: {
  title: string;
  conducted?: boolean;
  needsReschedule?: boolean;
}) {
  return (
    <span
      title={
        needsReschedule
          ? `${title}: нужно выбрать новый урок`
          : conducted
            ? `${title}: проведена`
            : `${title}: запланирована`
      }
      className={cx(
        'inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-10 font-bold uppercase',
        conducted ? 'bg-info-bg text-navy-700' : 'bg-navy-700 text-white',
        needsReschedule && 'ring-1 ring-brand-500',
      )}
    >
      {conducted && <Check className="size-2.5" aria-hidden />}
      {title}
    </span>
  );
}
