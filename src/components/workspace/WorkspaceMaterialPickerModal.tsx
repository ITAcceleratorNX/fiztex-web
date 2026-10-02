import { useEffect, useState } from 'react';
import { Folder, Link2, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FileTypeBadge } from '@/components/ui/FileTypeBadge';
import { FilterChip } from '@/components/ui/FilterChip';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { SelectableRow } from '@/components/ui/SelectableRow';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useTeacherWorkspaceFolders, useTeacherWorkspaceSearch } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { WorkspaceFileType, WorkspaceSearchItem, WorkspaceUsage } from '@/lib/teacherWorkspaceApi';

const formats: { label: string; value: WorkspaceFileType | '' }[] = [
  { label: 'Все', value: '' },
  { label: 'PDF', value: 'PDF' },
  { label: 'DOC', value: 'WORD' },
  { label: 'XLS', value: 'SPREADSHEET' },
  { label: 'PPT', value: 'PRESENTATION' },
  { label: 'JPG', value: 'IMAGE' },
];

export function WorkspaceMaterialPickerModal({ usage, onClose, onConfirm }: {
  usage: Extract<WorkspaceUsage, 'ATTACH_DOCUMENT_TO_HOMEWORK' | 'ATTACH_DOCUMENT_TO_LESSON'>;
  onClose: () => void;
  onConfirm: (items: WorkspaceSearchItem[]) => Promise<void> | void;
}) {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [fileType, setFileType] = useState<WorkspaceFileType | ''>('');
  const [folderId, setFolderId] = useState<number | undefined>();
  const [page, setPage] = useState(0);
  const [folderPage, setFolderPage] = useState(0);
  const [selected, setSelected] = useState<Map<number, WorkspaceSearchItem>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const folders = useTeacherWorkspaceFolders(folderPage);
  const search = useTeacherWorkspaceSearch({ q, type: 'DOCUMENT', fileType: fileType || undefined, folderId, usage, page });

  useEffect(() => {
    if (input === q) return;
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

  async function submit() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm([...selected.values()]);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось добавить материалы');
    } finally {
      setBusy(false);
    }
  }

  return <Modal open onClose={() => { if (!busy) onClose(); }} title="Выбор материалов" size="lg" footer={<>
    <Button variant="secondary" onClick={onClose} disabled={busy}>Отмена</Button>
    <Button onClick={() => void submit()} loading={busy} disabled={selected.size === 0}>Добавить{selected.size ? ` (${selected.size})` : ''}</Button>
  </>}>
    <div className="space-y-5">
      <SearchInput value={input} onChange={setInput} placeholder="Поиск по названию" className="w-full" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-13 font-medium text-slate-500">Тип материала</span>
        {formats.map((format) => <FilterChip key={format.label} label={format.label} selected={fileType === format.value} onClick={() => { setFileType(format.value); setPage(0); }} />)}
      </div>
      <div className="space-y-2">
        <p className="text-13 font-medium text-slate-500">Папка</p>
        {folders.isPending ? <LoadingBlock /> : folders.isError ? <ErrorBlock message="Не удалось загрузить данные" onRetry={() => folders.refetch()} /> : <>
          <div className="flex flex-wrap gap-2">
            <FilterChip label="Все материалы" selected={folderId == null} onClick={() => { setFolderId(undefined); setPage(0); }} />
            {folders.data?.content?.map((folder) => folder.id != null && <FilterChip
              key={folder.id}
              label={folder.name ?? `Папка №${folder.id}`}
              selected={folderId === folder.id}
              onClick={() => { setFolderId(folder.id); setPage(0); }}
            />)}
          </div>
          {(folders.data?.totalPages ?? 0) > 1 && <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" disabled={folderPage === 0} onClick={() => { setFolderId(undefined); setFolderPage(folderPage - 1); }}>Назад</Button>
            <Button variant="secondary" size="sm" disabled={folderPage + 1 >= (folders.data?.totalPages ?? 0)} onClick={() => { setFolderId(undefined); setFolderPage(folderPage + 1); }}>Далее</Button>
          </div>}
        </>}
      </div>
      {search.isPending ? <LoadingBlock /> : search.isError ? <ErrorBlock message="Не удалось загрузить данные" onRetry={() => search.refetch()} /> : (search.data?.items?.content ?? []).length === 0 ? (
        <EmptyBlock icon={q ? <Search className="size-7" /> : <Folder className="size-7" />} title={q ? 'Ничего не найдено' : 'Здесь пока нет материалов'} />
      ) : <div className="max-h-72 space-y-2 overflow-y-auto">
        {search.data?.items?.content?.map((item) => item.id != null && <SelectableRow
          key={item.id}
          title={item.title ?? `Материал №${item.id}`}
          meta={item.fileExtension?.toUpperCase() ?? 'Ссылка'}
          icon={item.fileExtension ? <FileTypeBadge format={item.fileExtension} /> : <Link2 className="size-5 text-cyan-600" />}
          checked={selected.has(item.id!)}
          disabled={item.selectable === false}
          onChange={(checked) => toggle(item, checked)}
        />)}
      </div>}
      {(search.data?.items?.totalPages ?? 0) > 1 && <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</Button>
        <Button variant="secondary" size="sm" disabled={page + 1 >= (search.data?.items?.totalPages ?? 0)} onClick={() => setPage(page + 1)}>Далее</Button>
      </div>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  </Modal>;
}
