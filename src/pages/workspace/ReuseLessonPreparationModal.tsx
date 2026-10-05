import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useApplyLessonPreparation, useLessonPreparation, useLessonPreparationTarget } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { Lesson } from '@/lib/lessonsApi';
import type { WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';
import { LessonDestinationPicker } from './LessonDestinationPicker';

export function ReuseLessonPreparationModal({ item, onClose }: { item: WorkspaceSearchItem; onClose: () => void }) {
  const [error, setError] = useState('');
  const [lesson, setLesson] = useState<Lesson | null>(null);
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
      toast.success('Заготовка применена к уроку');
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось применить заготовку');
      await target.refetch();
    }
  }

  return <Modal open onClose={() => { if (!apply.isPending) onClose(); }} title="Использовать заготовку" size="lg" footer={<>
    <Button variant="secondary" onClick={onClose} disabled={apply.isPending}>Отмена</Button>
    <Button onClick={() => void save()} loading={apply.isPending}
      disabled={!available || preparation.isPending || preparation.isError || !target.data?.targetRevision}>
      {replacing ? 'Заменить тему и конспект' : 'Применить к уроку'}
    </Button>
  </>}>
    <div className="space-y-4">
      {preparation.isPending ? <LoadingBlock /> : preparation.isError ? <ErrorBlock message="Не удалось загрузить данные" onRetry={() => preparation.refetch()} />
        : <p className="text-sm text-slate-600">{item.title} · версия {preparation.data?.version} · {preparation.data?.documents?.length ?? 0} материалов</p>}
      <LessonDestinationPicker selectedId={lessonId} onSelect={(selected) => { setLesson(selected); setError(''); }} />
      {lessonId != null && (target.isPending ? <LoadingBlock /> : target.isError ?
        <ErrorBlock message="Не удалось загрузить данные" onRetry={() => target.refetch()} /> :
        !target.data?.canApply ? <p className="text-sm text-slate-600">Этот урок нельзя изменить.</p> : null)}
      {available && replacing && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Тема или конспект урока уже заполнены. Применение заготовки заменит их сохранённой версией.</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  </Modal>;
}
