import { useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useApplyLessonPreparation, useCurrentLesson, useLessonPreparation, useLessonPreparationTarget } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';

export function ReuseLessonPreparationModal({ item, onClose }: { item: WorkspaceSearchItem; onClose: () => void }) {
  const [error, setError] = useState('');
  const current = useCurrentLesson();
  const lesson = current.data?.lesson;
  const lessonId = lesson?.id ?? null;
  const target = useLessonPreparationTarget(lessonId);
  const sourceId = Number(item.sourceId);
  const preparation = useLessonPreparation(Number.isSafeInteger(sourceId) && sourceId > 0 ? sourceId : null);
  const apply = useApplyLessonPreparation(lessonId ?? 0);
  const toast = useToast();
  const available = lessonId != null && lesson?.capabilities?.includes('EDIT_TEACHING_PART') && target.data?.canApply;
  const replacing = Boolean(target.data?.topic?.trim() || target.data?.draftSummary?.summaryText?.trim()
    || target.data?.draftSummary?.companionText?.trim() || target.data?.selectedTextbookId);

  async function save() {
    if (!item.id || lessonId == null || !preparation.data?.version || !target.data?.targetRevision || !available) return;
    setError('');
    try {
      await apply.mutateAsync({ workspaceItemId: item.id, version: preparation.data.version,
        expectedTargetRevision: target.data.targetRevision, confirmReplace: replacing });
      toast.success('Заготовка применена к текущему уроку');
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось применить заготовку');
      await target.refetch();
    }
  }

  return <Modal open onClose={() => { if (!apply.isPending) onClose(); }} title="Использовать заготовку" size="md" footer={<>
    <Button variant="secondary" onClick={onClose} disabled={apply.isPending}>Отмена</Button>
    <Button onClick={() => void save()} loading={apply.isPending}
      disabled={!available || preparation.isPending || preparation.isError || !target.data?.targetRevision}>
      {replacing ? 'Заменить тему и конспект' : 'Применить к уроку'}
    </Button>
  </>}>
    <div className="space-y-4">
      {preparation.isPending ? <LoadingBlock /> : preparation.isError ? <ErrorBlock message="Не удалось загрузить данные" onRetry={() => preparation.refetch()} />
        : <p className="text-sm text-slate-600">{item.title} · версия {preparation.data?.version} · {preparation.data?.documents?.length ?? 0} материалов</p>}
      {current.isPending || (lessonId != null && target.isPending) ? <LoadingBlock /> : current.isError || (lessonId != null && target.isError) ?
        <ErrorBlock message="Не удалось загрузить данные" onRetry={() => { void current.refetch(); if (lessonId != null) void target.refetch(); }} />
        : !available ? <EmptyBlock icon={<NotebookPen className="size-7" />} title="Нет доступного урока" description={current.data?.message} />
          : <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-900">
            <p className="font-semibold">{lesson?.subjectName || 'Урок'} · {lesson?.className || 'Класс'}</p>
            <p className="mt-1 text-slate-500">{lesson?.topic || 'Тема не указана'}</p>
          </div>}
      {available && replacing && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Тема или конспект урока уже заполнены. Применение заготовки заменит их сохранённой версией.</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  </Modal>;
}
