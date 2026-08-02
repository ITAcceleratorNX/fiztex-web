import type { Schema } from '@/lib/apiSchemas';
import { cx } from '@/lib/format';

type Lesson = Schema<'LessonView'>;

/**
 * Статус урока одним чипом (Figma 2067:9360, 2067:9487, 2067:9983).
 *
 * У урока два независимых статуса: бизнес-состояние (`status`) и вычисляемое
 * временнóе (`temporalStatus`). Пользователю важен один ответ, поэтому приоритет
 * задан здесь, а не в каждом месте вызова: отменённый урок остаётся отменённым,
 * даже когда его время идёт.
 *
 * Геометрия из макета общая для всех состояний: радиус 6, px 10 / py 4, 12px SemiBold.
 */
export function LessonStatusChip({
  status,
  temporalStatus,
  className,
}: {
  status?: Lesson['status'];
  temporalStatus?: Lesson['temporalStatus'];
  className?: string;
}) {
  const chip = resolve(status, temporalStatus);
  if (!chip) return null;
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold',
        chip.tone,
        className,
      )}
    >
      {chip.label}
    </span>
  );
}

function resolve(
  status: Lesson['status'],
  temporalStatus: Lesson['temporalStatus'],
): { label: string; tone: string } | null {
  if (status === 'CANCELLED') {
    return { label: 'Урок отменен', tone: 'border border-red-300 bg-cancelled-bg text-cancelled-fg' };
  }
  // Заменённая запись — служебный след переопубликации расписания, а не урок.
  if (status === 'SUPERSEDED') {
    return { label: 'Заменён', tone: 'bg-slate-200 text-slate-600' };
  }
  switch (temporalStatus) {
    case 'ONGOING':
      return { label: 'Идёт сейчас', tone: 'bg-brand-500 text-white' };
    case 'FINISHED':
      return { label: 'Завершён', tone: 'bg-success-bg text-success-fg' };
    case 'UPCOMING':
      return { label: 'Предстоящий', tone: 'bg-slate-200 text-slate-600' };
    default:
      return null;
  }
}
