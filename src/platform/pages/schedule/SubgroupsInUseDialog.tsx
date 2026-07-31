import { AlertTriangle, Loader2 } from 'lucide-react';
import { cx, pluralRu } from '@/lib/format';
import type { SubgroupInUse } from '@/lib/schedule2bTypes';
import { ModalActions, ModalCard, MODAL_PRIMARY, MODAL_SECONDARY } from './ModalCard';

/**
 * SUBGROUPS_IN_USE (409). Тот же смысл, что у предупреждения о занятом
 * шаблоне звонков (2015:9128) — жёлтая иконка, перечень влияния,
 * подтверждение действием «всё равно».
 */
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
    <ModalCard
      open={open}
      onClose={onCancel}
      labelledBy="subgroups-in-use-title"
      className="max-w-[440px] gap-5 p-6"
    >
      <div className="flex flex-col gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-50">
          <AlertTriangle className="size-5 text-amber-700" />
        </span>
        <h2 id="subgroups-in-use-title" className="text-xl font-bold text-ink">
          {title}
        </h2>
        <p className="text-13 leading-relaxed text-muted">
          Уроки в неархивных расписаниях ссылаются на эти подгруппы ({totalLessons}{' '}
          {pluralRu(totalLessons, ['урок', 'урока', 'уроков'])}). После архивации их придётся
          назначить заново.
        </p>
      </div>

      {rows.length > 0 && (
        <ul className="flex max-h-[220px] flex-col gap-2 overflow-y-auto rounded-lg bg-gray-50 p-3">
          {rows.map((row) => (
            <li key={row.subgroupId} className="flex items-center justify-between gap-3 text-13">
              <span className="truncate font-medium text-ink">
                {row.name || `Подгруппа #${row.subgroupId}`}
              </span>
              <span className="shrink-0 text-muted">
                {row.lessonCount} {pluralRu(row.lessonCount, ['урок', 'урока', 'уроков'])}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ModalActions>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className={cx(MODAL_SECONDARY, 'text-muted')}
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onConfirmImpact}
          disabled={loading}
          className={cx(MODAL_PRIMARY, 'inline-flex items-center gap-2 bg-red-500 hover:bg-red-600')}
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          Архивировать всё равно
        </button>
      </ModalActions>
    </ModalCard>
  );
}
