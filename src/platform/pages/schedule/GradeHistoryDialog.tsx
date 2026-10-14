import { Modal } from '@/components/ui/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useGradeHistory } from '@/hooks/queries';
import { gradeHistoryActor, gradeHistoryDescription, gradeHistoryTime } from '@/lib/gradeHistoryModel';

export function GradeHistoryDialog({ gradeId, studentName, onClose }: {
  gradeId: number; studentName: string; onClose: () => void;
}) {
  const history = useGradeHistory(gradeId);
  return (
    <Modal open title="История оценки" subtitle={studentName} onClose={onClose} scrollable>
      {history.isPending || history.isFetching ? <LoadingBlock label="Загружаем историю…" />
        : history.isError ? <ErrorBlock message="Не удалось загрузить историю оценки" onRetry={() => void history.refetch()} />
        : !history.data?.length ? <EmptyBlock title="История пуста" />
        : <ol className="space-y-3" aria-label="Изменения оценки">
          {history.data.map(event => <li key={event.id} className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">{gradeHistoryDescription(event)}</p>
            <p className="mt-1 text-sm text-slate-600">{gradeHistoryActor(event)}</p>
            <time className="mt-1 block text-xs text-slate-500" dateTime={event.createdAt}>{gradeHistoryTime(event.createdAt)}</time>
          </li>)}
        </ol>}
    </Modal>
  );
}
