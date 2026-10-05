import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useDeleteWorkspaceMaterial, useTeacherWorkspaceDependencies } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { WorkspaceDependencies, WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';

function dependencyLabel(dependency: NonNullable<WorkspaceDependencies['dependencies']>[number]) {
  const type = dependency.type === 'HOMEWORK' ? 'Домашнее задание'
    : dependency.type === 'LESSON' ? 'Урок' : 'Подготовленный урок';
  const context = [dependency.className, dependency.subjectName].filter(Boolean).join(' · ');
  const date = dependency.lessonDate ? new Intl.DateTimeFormat('ru-RU').format(new Date(dependency.lessonDate)) : '';
  return `${type} «${dependency.title || `№${dependency.targetId}`}»${context ? ` — ${context}` : ''}${date ? `, ${date}` : ''}`;
}

export function DeleteMaterialModal({ item, onClose }: {
  item: WorkspaceSearchItem | null;
  onClose: () => void;
}) {
  const materialId = item?.sourceKind === 'teacher-workspace-material' ? Number(item.sourceId) : null;
  const validId = materialId != null && Number.isSafeInteger(materialId) && materialId > 0 ? materialId : null;
  const dependencies = useTeacherWorkspaceDependencies(validId);
  const remove = useDeleteWorkspaceMaterial();
  const toast = useToast();
  const usages = dependencies.data?.dependencies ?? [];

  async function confirm() {
    if (validId == null || !dependencies.data?.revision) return;
    try {
      await remove.mutateAsync({ id: validId, revision: dependencies.data.revision });
      toast.success('Материал удалён');
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'WORKSPACE_DEPENDENCIES_CHANGED') {
        await dependencies.refetch();
        toast.error('Использования материала изменились. Проверьте список и подтвердите ещё раз.');
      } else {
        toast.error(caught instanceof ApiError ? caught.message : 'Не удалось удалить материал');
      }
    }
  }

  return <Modal
    open={item != null}
    onClose={() => { if (!remove.isPending) onClose(); }}
    title={usages.length ? 'Материал используется в других местах' : 'Удалить материал?'}
    size="md"
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={remove.isPending}>Отмена</Button>
      <Button variant="danger" onClick={() => void confirm()} loading={remove.isPending} disabled={!dependencies.data?.revision}>
        {usages.length ? 'Всё равно удалить' : 'Удалить'}
      </Button>
    </>}
  >
    {dependencies.isPending ? <LoadingBlock /> : dependencies.isError || validId == null ? (
      <ErrorBlock message="Не удалось загрузить данные" onRetry={() => dependencies.refetch()} />
    ) : usages.length ? <>
      <p className="mb-4 text-sm text-slate-600">«{item?.title}» сейчас используется в:</p>
      <ul className="space-y-2 text-sm text-slate-900">
        {usages.map((dependency, index) => <li key={`${dependency.type}-${dependency.targetId}-${index}`} className="flex gap-2">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-slate-600" aria-hidden="true" />
          <span>{dependencyLabel(dependency)}</span>
        </li>)}
      </ul>
      <p className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-3 text-13 font-semibold text-orange-700">
        После удаления материал перестанет быть доступен в этих местах. Действие нельзя отменить.
      </p>
    </> : <p className="text-sm text-slate-600">«{item?.title}» будет удалено безвозвратно.</p>}
  </Modal>;
}
