import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SummaryDocument } from '@/components/ui/SummaryDocument';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useLessonPreparation } from '@/hooks/queries';
import type { WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';

export function LessonPreparationDetailModal({ item, onClose, onReuse }: {
  item: WorkspaceSearchItem;
  onClose: () => void;
  onReuse: () => void;
}) {
  const sourceId = Number(item.sourceId);
  const preparation = useLessonPreparation(Number.isSafeInteger(sourceId) && sourceId > 0 ? sourceId : null);

  return <Modal open onClose={onClose} title={item.title ?? 'Заготовка урока'} size="lg" footer={<>
    <Button variant="secondary" onClick={onClose}>Закрыть</Button>
    <Button onClick={onReuse} disabled={preparation.isPending || preparation.isError}>Использовать повторно</Button>
  </>}>
    {preparation.isPending ? <LoadingBlock /> : preparation.isError ?
      <ErrorBlock message="Не удалось загрузить данные" onRetry={() => preparation.refetch()} /> : <div className="space-y-4">
        <p className="text-sm text-slate-600">Версия {preparation.data?.version} · Тема: {preparation.data?.topic || 'не указана'}</p>
        {preparation.data?.summary && <SummaryDocument content={preparation.data.summary} />}
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-900">Материалы</p>
          {(preparation.data?.documents ?? []).length === 0 ? <p className="text-sm text-slate-500">Материалы не добавлены</p>
            : <ul className="space-y-2">{preparation.data?.documents?.map((document, index) => <li key={index}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
              {document.title ?? `Материал ${index + 1}`}{document.available === false ? ' · недоступен' : ''}
            </li>)}</ul>}
        </div>
      </div>}
  </Modal>;
}
