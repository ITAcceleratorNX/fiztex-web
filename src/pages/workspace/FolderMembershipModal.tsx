import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useAttachWorkspaceFolderItem, useDetachWorkspaceFolderItem, useTeacherWorkspaceFolders } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';
import { CreateFolderModal } from './CreateFolderModal';

export function FolderMembershipModal({ item, onClose }: {
  item: WorkspaceSearchItem | null;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const folders = useTeacherWorkspaceFolders(page);
  const attach = useAttachWorkspaceFolderItem();
  const detach = useDetachWorkspaceFolderItem();
  const toast = useToast();
  const busy = attach.isPending || detach.isPending;

  useEffect(() => {
    setPage(0);
    setSelected(new Set(item?.folders?.flatMap((folder) => folder.id == null ? [] : [folder.id]) ?? []));
    setError('');
  }, [item]);

  function toggle(folderId: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  }

  async function save() {
    if (!item?.id) return;
    const before = new Set(item.folders?.flatMap((folder) => folder.id == null ? [] : [folder.id]) ?? []);
    try {
      for (const folderId of selected) {
        if (!before.has(folderId)) await attach.mutateAsync({ folderId, itemId: item.id });
      }
      for (const folderId of before) {
        if (!selected.has(folderId)) await detach.mutateAsync({ folderId, itemId: item.id });
      }
      toast.success('Папки материала обновлены');
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось обновить папки. Проверьте состояние материала и повторите.');
    }
  }

  return <>
    <Modal open={item != null} onClose={onClose} title="Добавить в папку" size="md" footer={<>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Отмена</Button>
      <Button onClick={() => void save()} loading={busy}>Сохранить</Button>
    </>}>
      <p className="mb-4 text-sm text-slate-600">Выберите одну или несколько папок, в которые хотите добавить материал.</p>
      {folders.isPending ? <LoadingBlock /> : folders.isError ? <ErrorBlock message="Не удалось загрузить данные" onRetry={() => folders.refetch()} /> : <>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {(folders.data?.content ?? []).length === 0 && <p className="py-5 text-center text-sm text-slate-500">Пока нет папок</p>}
          {folders.data?.content?.map((folder) => folder.id != null && <label key={folder.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 hover:bg-slate-50">
            <input type="checkbox" checked={selected.has(folder.id!)} onChange={() => toggle(folder.id!)} disabled={busy} className="size-5 accent-navy-700" />
            {folder.name}
          </label>)}
        </div>
        {(folders.data?.totalPages ?? 0) > 1 && <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</Button>
          <Button variant="secondary" size="sm" disabled={page + 1 >= (folders.data?.totalPages ?? 0)} onClick={() => setPage(page + 1)}>Далее</Button>
        </div>}
      </>}
      <button type="button" onClick={() => setCreating(true)} className="mt-4 flex items-center gap-2 text-sm font-semibold text-navy-700 hover:underline"><Plus className="size-4" />Создать новую папку</button>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
    <CreateFolderModal open={creating} onClose={() => setCreating(false)} onCreated={(folder) => {
      setCreating(false);
      if (folder.id != null) setSelected((current) => new Set(current).add(folder.id!));
    }} />
  </>;
}
