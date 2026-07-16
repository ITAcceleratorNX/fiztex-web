import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { SubgroupInUse } from '@/lib/schedule2bTypes';
import { pluralRu } from '@/lib/format';

export function SubgroupsInUseDialog({
  open,
  rows,
  loading,
  onCancel,
  onConfirmImpact,
  title = 'Подгруппы используются в расписании',
}: {
  open: boolean;
  rows: SubgroupInUse[];
  loading?: boolean;
  onCancel: () => void;
  onConfirmImpact: () => void;
  title?: string;
}) {
  const totalLessons = rows.reduce((sum, row) => sum + row.lessonCount, 0);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Отмена
          </Button>
          <Button variant="danger" onClick={onConfirmImpact} loading={loading}>
            Архивировать всё равно
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">
        Подгруппы связаны с уроками в неархивных расписаниях (
        {totalLessons}{' '}
        {pluralRu(totalLessons, ['урок', 'урока', 'уроков'])}
        ). Подтвердите влияние, чтобы продолжить.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
        {rows.map((row) => (
          <li key={row.subgroupId} className="flex justify-between gap-3">
            <span className="font-medium text-slate-800">{row.name || `Подгруппа #${row.subgroupId}`}</span>
            <span className="text-slate-500">
              {row.lessonCount} {pluralRu(row.lessonCount, ['урок', 'урока', 'уроков'])}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
