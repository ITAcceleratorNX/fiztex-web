import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { Modal } from '@/components/ui/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useApplyTestTemplate, useHomeworkList, useTestTemplate, useTestTemplateTarget } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { Homework } from '@/lib/homeworkApi';
import type { WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';

function canUse(homework: Homework) {
  return homework.answerFormat === 'TEST' && homework.status !== 'COMPLETED'
    && homework.status !== 'CANCELLED' && homework.hasAnswers !== true;
}

export function ReuseTestTemplateModal({ item, onClose }: { item: WorkspaceSearchItem; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const [homeworkId, setHomeworkId] = useState<number | null>(null);
  const [applyKey, setApplyKey] = useState('');
  const [error, setError] = useState('');
  const templateId = Number(item.sourceId);
  const template = useTestTemplate(Number.isSafeInteger(templateId) && templateId > 0 ? templateId : null);
  const homework = useHomeworkList({ scope: 'ACTUAL', statuses: ['DRAFT', 'PUBLISHED'], page, size: 10 });
  const target = useTestTemplateTarget(homeworkId);
  const apply = useApplyTestTemplate(homeworkId ?? 0);
  const toast = useToast();
  const choices = (homework.data?.content ?? []).filter(entry => template.data?.subjectId != null && entry.subjectId === template.data.subjectId);
  const available = choices.some(canUse);

  async function save() {
    if (item.id == null || homeworkId == null || template.data?.version == null || !target.data?.questionRevision) return;
    setError('');
    try {
      await apply.mutateAsync({ body: {
        workspaceItemId: item.id,
        version: template.data.version,
        expectedQuestionRevision: target.data.questionRevision,
        confirmReplace: (target.data.questionCount ?? 0) > 0,
      }, key: applyKey });
      toast.success('Тест добавлен в домашнее задание');
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось применить тест');
      await target.refetch();
      if (caught instanceof ApiError && caught.status === 409) setApplyKey(crypto.randomUUID());
    }
  }

  return <Modal open onClose={() => { if (!apply.isPending) onClose(); }} title="Использовать тест повторно" size="lg" footer={<>
    <Button variant="secondary" onClick={onClose} disabled={apply.isPending}>Отмена</Button>
    <Button onClick={() => void save()} loading={apply.isPending}
      disabled={homeworkId == null || template.isPending || template.isError || target.isPending || target.isError || !target.data?.questionRevision}>
      {(target.data?.questionCount ?? 0) > 0 ? 'Заменить вопросы' : 'Добавить вопросы'}
    </Button>
  </>}>
    <div className="space-y-4">
      {template.data && template.data.subjectId == null && <p role="status" className="text-sm text-attention-fg">У этой версии нет предмета. Откройте редактор и сохраните новую версию с предметом перед применением к ДЗ.</p>}
      {template.isPending ? <LoadingBlock /> : template.isError ? <ErrorBlock message="Не удалось загрузить данные" onRetry={() => template.refetch()} />
        : <p className="text-sm text-slate-600">{item.title} · версия {template.data?.version} · {template.data?.definition?.questions?.length ?? 0} вопросов</p>}
      {homework.isPending ? <LoadingBlock /> : homework.isError ? <ErrorBlock message="Не удалось загрузить данные" onRetry={() => homework.refetch()} />
        : !available ? <EmptyBlock icon={<BookOpen className="size-7" />}
          title={(homework.data?.totalPages ?? 0) > 1 ? 'На этой странице нет доступных домашних заданий' : 'Нет доступных домашних заданий'} />
          : <div className="max-h-72 space-y-2 overflow-y-auto">
            {choices.map((entry) => entry.id != null && <ChoiceRow key={entry.id} icon={<BookOpen className="size-5" />}
              title={entry.title ?? `ДЗ №${entry.id}`}
              description={[entry.className, entry.subjectName, canUse(entry) ? '' : 'Недоступно для теста'].filter(Boolean).join(' · ')}
              selected={homeworkId === entry.id} disabled={!canUse(entry)}
              onClick={() => { setHomeworkId(entry.id!); setApplyKey(crypto.randomUUID()); setError(''); }} />)}
          </div>}
      {(homework.data?.totalPages ?? 0) > 1 && <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => { setPage(page - 1); setHomeworkId(null); }}>Назад</Button>
        <Button variant="secondary" size="sm" disabled={page + 1 >= (homework.data?.totalPages ?? 0)} onClick={() => { setPage(page + 1); setHomeworkId(null); }}>Далее</Button>
      </div>}
      {homeworkId != null && (target.isPending ? <LoadingBlock /> : target.isError ?
        <ErrorBlock message="Не удалось загрузить данные" onRetry={() => target.refetch()} />
        : (target.data?.questionCount ?? 0) > 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          В выбранном ДЗ уже есть вопросы. Применение теста заменит их.
        </p>)}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  </Modal>;
}
