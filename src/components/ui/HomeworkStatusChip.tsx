import { cx } from '@/lib/format';
import type { Homework } from '@/lib/homeworkApi';

/**
 * Статус домашнего задания одним чипом (Figma 856:20520, мобильный 868:247).
 *
 * Просрочка — не статус, а признак поверх «Опубликовано» (ТЗ HOMEWORK-001 §9,
 * HOMEWORK-005.1 §5). Учителю нужен один ответ, поэтому приоритет задан здесь, а не
 * в каждом месте вызова: истёкший срок вытесняет подпись «Опубликовано», но задание
 * остаётся активным и лежит на вкладке «Актуальные».
 *
 * Геометрия из макета: радиус 4, px 8 / py 2, 11px Medium.
 */
export function HomeworkStatusChip({
  status,
  overdue = false,
  className,
}: {
  status?: Homework['status'];
  overdue?: boolean;
  className?: string;
}) {
  const chip = resolve(status, overdue);
  if (!chip) return null;
  return (
    <span
      className={cx(
        'inline-flex items-center rounded px-2 py-0.5 text-11 font-medium',
        chip.tone,
        className,
      )}
    >
      {chip.label}
    </span>
  );
}

function resolve(
  status: Homework['status'],
  overdue: boolean,
): { label: string; tone: string } | null {
  switch (status) {
    case 'DRAFT':
      return { label: 'Черновик', tone: 'bg-neutral-bg text-neutral-fg' };
    case 'PUBLISHED':
      return overdue
        ? { label: 'Просрочено', tone: 'bg-attention-bg text-attention-fg' }
        : { label: 'Опубликовано', tone: 'bg-success-bg text-success-fg' };
    case 'COMPLETED':
      return { label: 'Завершено', tone: 'bg-info-bg text-link' };
    case 'CANCELLED':
      return { label: 'Отменено', tone: 'bg-neutral-bg text-neutral-fg' };
    default:
      return null;
  }
}
