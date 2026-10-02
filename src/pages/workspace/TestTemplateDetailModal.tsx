import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { MathText } from '@/components/ui/MathText';
import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useTestTemplate } from '@/hooks/queries';
import type { WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';

export function TestTemplateDetailModal({ item, onClose, onReuse }: {
  item: WorkspaceSearchItem;
  onClose: () => void;
  onReuse: () => void;
}) {
  const sourceId = Number(item.sourceId);
  const template = useTestTemplate(Number.isSafeInteger(sourceId) && sourceId > 0 ? sourceId : null);

  return <Modal open onClose={onClose} title={item.title ?? 'Сохранённый тест'} size="lg" footer={<>
    <Button variant="secondary" onClick={onClose}>Закрыть</Button>
    <Button onClick={onReuse} disabled={template.isPending || template.isError}>Использовать повторно</Button>
  </>}>
    {template.isPending ? <LoadingBlock /> : template.isError ?
      <ErrorBlock message="Не удалось загрузить данные" onRetry={() => template.refetch()} /> : <div className="space-y-4">
        <p className="text-sm text-slate-600">Версия {template.data?.version} · {template.data?.definition?.questions?.length ?? 0} вопросов</p>
        {(template.data?.definition?.questions ?? []).map((question, index) => <div key={index} className="rounded-xl border border-slate-200 p-4">
          <p className="mb-1 text-xs font-semibold text-slate-500">Вопрос {index + 1}</p>
          <MathText text={question.text ?? ''} />
        </div>)}
        {template.data?.sourceHomeworkId != null && <Link className="text-sm font-semibold text-navy-700 hover:underline"
          to={`/homework/${template.data.sourceHomeworkId}`} onClick={onClose}>Открыть исходное ДЗ</Link>}
      </div>}
  </Modal>;
}
