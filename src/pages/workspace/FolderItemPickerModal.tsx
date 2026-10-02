import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FileTypeBadge } from '@/components/ui/FileTypeBadge';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { SelectableRow } from '@/components/ui/SelectableRow';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useAttachWorkspaceFolderItem, useTeacherWorkspaceSearch } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { WorkspaceMaterialType, WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';

const typeLabels: Record<WorkspaceMaterialType, string> = {
  TEXTBOOK: 'Учебник',
  CURRICULUM_PLAN: 'КТП',
  PREPARED_LESSON: 'Подготовленный урок',
  TEST: 'Тест',
  HOMEWORK: 'Домашнее задание',
  DOCUMENT: 'Документ или ссылка',
};

export function FolderItemPickerModal({ folderId, onClose }: { folderId: number; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [type, setType] = useState<WorkspaceMaterialType | ''>('');
  const [selected, setSelected] = useState<Map<number, WorkspaceSearchItem>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const search = useTeacherWorkspaceSearch({ q, type: type || undefined, page });
  const attach = useAttachWorkspaceFolderItem();
  const toast = useToast();

  useEffect(() => {
    if (input.trim() === q) return;
    const timer = window.setTimeout(() => { setQ(input.trim()); setPage(0); }, 300);
    return () => window.clearTimeout(timer);
  }, [input, q]);

  function toggle(item: WorkspaceSearchItem, checked: boolean) {
    if (item.id == null) return;
    setSelected((current) => {
      const next = new Map(current);
      if (checked) next.set(item.id!, item); else next.delete(item.id!);
      return next;
    });
  }

  async function save() {
    if (busy || selected.size === 0) return;
    setBusy(true);
    setError('');
    try {
      for (const item of selected.values()) {
        if (item.id == null) continue;
        await attach.mutateAsync({ folderId, itemId: item.id });
        setSelected((current) => {
          const next = new Map(current);
          next.delete(item.id!);
          return next;
        });
      }
      toast.success('Материалы добавлены в папку');
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось добавить материалы');
    } finally {
      setBusy(false);
    }
  }

  return <Modal open onClose={() => { if (!busy) onClose(); }} title="Выбрать из рабочего пространства" size="lg" footer={<>
    <Button variant="secondary" onClick={onClose} disabled={busy}>Отмена</Button>
    <Button onClick={() => void save()} loading={busy} disabled={selected.size === 0}>Добавить{selected.size ? ` (${selected.size})` : ''}</Button>
  </>}>
    <div className="space-y-4">
      <SearchInput value={input} onChange={setInput} placeholder="Поиск по материалам" className="w-full" />
      <Select aria-label="Тип материала" value={type} onChange={(event) => { setType(event.target.value as WorkspaceMaterialType | ''); setPage(0); }} className="w-full">
        <option value="">Все типы материалов</option>
        {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>
      {search.isPending ? <LoadingBlock /> : search.isError ? <ErrorBlock message="Не удалось загрузить данные" onRetry={() => search.refetch()} />
        : (search.data?.items?.content ?? []).length === 0 ? <EmptyBlock icon={<Search className="size-7" />} title={q ? 'Ничего не найдено' : 'Здесь пока нет материалов'} />
          : <div className="max-h-72 space-y-2 overflow-y-auto">
            {search.data?.items?.content?.map((item) => item.id != null && <SelectableRow key={item.id}
              title={item.title ?? `Материал №${item.id}`}
              meta={item.fileExtension?.toUpperCase() ?? (item.type ? typeLabels[item.type] : 'Материал')}
              icon={item.fileExtension ? <FileTypeBadge format={item.fileExtension} /> : undefined}
              checked={selected.has(item.id)}
              disabled={item.folders?.some((folder) => folder.id === folderId)}
              onChange={(checked) => toggle(item, checked)} />)}
          </div>}
      {(search.data?.items?.totalPages ?? 0) > 1 && <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</Button>
        <Button variant="secondary" size="sm" disabled={page + 1 >= (search.data?.items?.totalPages ?? 0)} onClick={() => setPage(page + 1)}>Далее</Button>
      </div>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  </Modal>;
}
