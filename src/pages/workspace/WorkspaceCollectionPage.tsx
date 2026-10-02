import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, Folder, Plus } from 'lucide-react';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, TextInput } from '@/components/ui/Field';
import { FileTypeBadge } from '@/components/ui/FileTypeBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import {
  useDeleteWorkspaceFolder, useDetachWorkspaceFolderItem, useRenameWorkspaceFolder,
  useRenameWorkspaceMaterial,
  useTeacherWorkspaceFolder, useTeacherWorkspaceSearch, useTeacherWorkspaceSection,
} from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { openWorkspaceDocument } from '@/lib/teacherWorkspaceOpen';
import { ROUTES } from '@/lib/routes';
import type { WorkspaceMaterialType, WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';
import { CreateMaterialModal } from './CreateMaterialModal';
import { DeleteMaterialModal } from './DeleteMaterialModal';
import { FolderMembershipModal } from './FolderMembershipModal';
import { FolderItemPickerModal } from './FolderItemPickerModal';
import { ReuseMaterialModal } from './ReuseMaterialModal';
import { ReuseTestTemplateModal } from './ReuseTestTemplateModal';
import { TestTemplateDetailModal } from './TestTemplateDetailModal';
import { ReuseLessonPreparationModal } from './ReuseLessonPreparationModal';
import { LessonPreparationDetailModal } from './LessonPreparationDetailModal';

const sectionTypes: Record<string, WorkspaceMaterialType | null> = {
  ACHIEVEMENTS: null,
  TEXTBOOKS: 'TEXTBOOK',
  CURRICULUM_PLANS: 'CURRICULUM_PLAN',
  PREPARED_LESSONS: 'PREPARED_LESSON',
  TESTS: 'TEST',
  HOMEWORK: 'HOMEWORK',
  DOCUMENTS: 'DOCUMENT',
};

function formatDate(value?: string) {
  return value ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value)) : '—';
}

function WorkspaceRow({ item, folderId, onOpen, onAddToFolder, onRemove, onRename, onDelete, onReuse }: {
  item: WorkspaceSearchItem;
  folderId?: number;
  onOpen: () => void;
  onAddToFolder: () => void;
  onRemove: () => void;
  onRename: () => void;
  onDelete: () => void;
  onReuse: () => void;
}) {
  const format = item.fileExtension?.toUpperCase();
  return (
    <div className="flex min-h-16 items-center gap-2 border-b border-slate-200 px-5 py-3 last:border-b-0">
      <span className="shrink-0">{format ? <FileTypeBadge format={format} /> : <Badge tone="navy">{item.type === 'DOCUMENT' ? 'Ссылка' : item.type}</Badge>}</span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:underline">
        <span className="block truncate text-sm font-semibold text-slate-900">{item.title}</span>
        <span className="mt-0.5 block text-xs text-slate-400">{format || (item.type === 'DOCUMENT' ? 'Ссылка' : 'Материал')} · Добавлен {formatDate(item.addedAt)}</span>
      </button>
      <span className="hidden w-52 shrink-0 items-center gap-2 text-13 text-slate-700 md:flex">
        {item.author || '—'}
      </span>
      <ActionMenu label={`Действия: ${item.title}`} items={[
        { label: 'Открыть', onSelect: onOpen },
        ...(item.sourceKind === 'teacher-workspace-material' ? [{ label: 'Переименовать', onSelect: onRename }] : []),
        { label: 'Добавить в папку / изменить папку', onSelect: onAddToFolder },
        ...(item.supportedActions?.some((action) => action === 'ATTACH_DOCUMENT_TO_HOMEWORK' || action === 'ATTACH_DOCUMENT_TO_LESSON' || action === 'APPLY_TEST_TO_HOMEWORK' || action === 'APPLY_PREPARATION_TO_LESSON')
          ? [{ label: 'Использовать повторно', onSelect: onReuse }] : []),
        ...(folderId != null ? [{ label: 'Убрать из этой папки', onSelect: onRemove, danger: true }] : []),
        ...(item.sourceKind === 'teacher-workspace-material' ? [{ label: 'Удалить', onSelect: onDelete, danger: true }] : []),
      ]} />
    </div>
  );
}

export function WorkspaceCollectionPage({ kind }: { kind: 'section' | 'folder' }) {
  const { sectionCode, folderId: folderIdParam } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const folderId = Number(folderIdParam);
  const isFolder = kind === 'folder';
  const pageRaw = Number(params.get('page') ?? 0);
  const page = Number.isInteger(pageRaw) && pageRaw >= 0 ? pageRaw : 0;
  const code = sectionCode ?? '';
  const sectionType = sectionTypes[code];
  const folder = useTeacherWorkspaceFolder(folderId, page, isFolder && Number.isInteger(folderId) && folderId > 0);
  const section = useTeacherWorkspaceSection(code, page, !isFolder);
  const search = useTeacherWorkspaceSearch(
    isFolder ? { folderId, page } : { type: sectionType ?? undefined, page },
    isFolder ? Number.isInteger(folderId) && folderId > 0 : Boolean(sectionType),
  );
  const [adding, setAdding] = useState(false);
  const [pickingExisting, setPickingExisting] = useState(false);
  const [addingToFolder, setAddingToFolder] = useState<WorkspaceSearchItem | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeItem, setRemoveItem] = useState<WorkspaceSearchItem | null>(null);
  const [renameItem, setRenameItem] = useState<WorkspaceSearchItem | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [deleteItem, setDeleteItem] = useState<WorkspaceSearchItem | null>(null);
  const [reuseItem, setReuseItem] = useState<WorkspaceSearchItem | null>(null);
  const [testDetail, setTestDetail] = useState<WorkspaceSearchItem | null>(null);
  const [preparationDetail, setPreparationDetail] = useState<WorkspaceSearchItem | null>(null);
  const rename = useRenameWorkspaceFolder();
  const deleteFolder = useDeleteWorkspaceFolder();
  const detach = useDetachWorkspaceFolderItem();
  const renameMaterial = useRenameWorkspaceMaterial();
  const title = isFolder ? folder.data?.folder?.name : section.data?.section?.title;
  useDocumentTitle(title ? `${title} — Рабочее пространство` : 'Рабочее пространство');
  const list = isFolder ? folder : section;
  const items = sectionType === null && !isFolder ? [] : (search.data?.items?.content ?? []);
  const total = sectionType === null && !isFolder ? 0 : (search.data?.items?.totalElements ?? 0);
  const searchEnabled = isFolder || Boolean(sectionType);

  function setPage(next: number) {
    setParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set('page', String(next));
      return updated;
    });
  }

  async function open(item: WorkspaceSearchItem) {
    if (item.sourceKind === 'homework-test-template') {
      setTestDetail(item);
      return;
    }
    if (item.sourceKind === 'lesson-preparation') {
      setPreparationDetail(item);
      return;
    }
    if (item.sourceKind === 'teacher-homework' && item.sourceId) {
      navigate(`/homework/${item.sourceId}`);
      return;
    }
    if (item.sourceKind === 'teacher-textbook') {
      navigate(ROUTES.textbooks);
      return;
    }
    if (item.sourceKind !== 'teacher-workspace-material' || !item.sourceId) {
      toast.info('Для этого типа материала просмотр появится в следующем шаге');
      return;
    }
    try {
      await openWorkspaceDocument(item);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Не удалось открыть материал');
    }
  }

  async function saveRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isFolder || !renameValue.trim() || renameValue.trim().length > 120) return;
    try {
      await rename.mutateAsync({ id: folderId, name: renameValue.trim() });
      setRenameOpen(false);
      toast.success('Папка переименована');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Не удалось переименовать папку');
    }
  }

  async function confirmDelete() {
    try {
      await deleteFolder.mutateAsync(folderId);
      navigate(ROUTES.workspace);
      toast.success('Папка удалена');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Не удалось удалить папку');
    }
  }

  async function confirmRemove() {
    if (!removeItem?.id) return;
    try {
      await detach.mutateAsync({ folderId, itemId: removeItem.id });
      setRemoveItem(null);
      toast.success('Материал убран из папки');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Не удалось убрать материал');
    }
  }

  async function saveMaterialRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = Number(renameItem?.sourceId);
    if (!Number.isSafeInteger(id) || id <= 0 || !materialTitle.trim()) return;
    try {
      await renameMaterial.mutateAsync({ id, title: materialTitle.trim() });
      setRenameItem(null);
      toast.success('Материал переименован');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Не удалось переименовать материал');
    }
  }

  if (isFolder && (!Number.isInteger(folderId) || folderId <= 0)) return <ErrorBlock message="Папка не найдена" />;
  if (!isFolder && !(code in sectionTypes)) return <ErrorBlock message="Раздел не найден" />;
  if (list.isPending) return <LoadingBlock />;
  if (list.isError) return <ErrorBlock message="Не удалось загрузить данные" onRetry={() => list.refetch()} />;

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-white p-2 md:p-4">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={ROUTES.workspace} aria-label="Вернуться в рабочее пространство" className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"><ArrowLeft className="size-5" /></Link>
          <div><p className="text-11 font-semibold uppercase text-slate-500">Рабочее пространство</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{isFolder ? `Личная папка — ${title}` : title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(isFolder || code === 'DOCUMENTS') && <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>{isFolder ? 'Добавить материал' : 'Добавить'}</Button>}
          {isFolder && <ActionMenu label="Действия с папкой" items={[
            { label: 'Переименовать', onSelect: () => { setRenameValue(title ?? ''); setRenameOpen(true); } },
            { label: 'Удалить папку', onSelect: () => setDeleteOpen(true), danger: true },
          ]} />}
        </div>
      </header>
      {searchEnabled && search.isPending && <LoadingBlock />}
      {searchEnabled && search.isError && <ErrorBlock message="Не удалось загрузить данные" onRetry={() => search.refetch()} />}
      {(!searchEnabled || (!search.isError && !search.isPending)) && items.length === 0 && <div className="flex min-h-[30rem] items-center justify-center">
        <EmptyBlock icon={isFolder ? <Folder className="size-8" /> : <FileText className="size-8" />} title={isFolder ? 'В этой папке пока нет материалов' : 'В этом разделе пока нет материалов'} />
      </div>}
      {!search.isError && items.length > 0 && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex h-11 items-center border-b border-slate-200 bg-slate-50 px-5 text-xs font-bold uppercase text-slate-400">
          <span className="flex-1">Материал</span><span className="hidden w-52 md:block">Добавил</span><span className="w-8" />
        </div>
        {items.map((item) => item.id != null && <WorkspaceRow key={item.id} item={item} folderId={isFolder ? folderId : undefined} onOpen={() => void open(item)} onAddToFolder={() => setAddingToFolder(item)} onRemove={() => setRemoveItem(item)} onRename={() => { setRenameItem(item); setMaterialTitle(item.title ?? ''); }} onDelete={() => setDeleteItem(item)} onReuse={() => setReuseItem(item)} />)}
      </div>}
      {total > 20 && <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</Button>
        <Button variant="secondary" size="sm" disabled={(page + 1) * 20 >= total} onClick={() => setPage(page + 1)}>Далее</Button>
      </div>}
      <CreateMaterialModal open={adding} onClose={() => setAdding(false)} folderId={isFolder ? folderId : undefined}
        onPickExisting={isFolder ? () => setPickingExisting(true) : undefined} />
      {isFolder && pickingExisting && <FolderItemPickerModal folderId={folderId} onClose={() => setPickingExisting(false)} />}
      <FolderMembershipModal item={addingToFolder} onClose={() => setAddingToFolder(null)} />
      <DeleteMaterialModal item={deleteItem} onClose={() => setDeleteItem(null)} />
      {reuseItem?.sourceKind === 'homework-test-template'
        ? <ReuseTestTemplateModal key={reuseItem.id} item={reuseItem} onClose={() => setReuseItem(null)} />
        : reuseItem?.sourceKind === 'lesson-preparation'
          ? <ReuseLessonPreparationModal key={reuseItem.id} item={reuseItem} onClose={() => setReuseItem(null)} />
        : reuseItem && <ReuseMaterialModal key={reuseItem.id} item={reuseItem} onClose={() => setReuseItem(null)} />}
      {testDetail && <TestTemplateDetailModal key={testDetail.id} item={testDetail} onClose={() => setTestDetail(null)}
        onReuse={() => { setReuseItem(testDetail); setTestDetail(null); }} />}
      {preparationDetail && <LessonPreparationDetailModal key={preparationDetail.id} item={preparationDetail}
        onClose={() => setPreparationDetail(null)} onReuse={() => { setReuseItem(preparationDetail); setPreparationDetail(null); }} />}
      <Modal open={renameItem != null} onClose={() => setRenameItem(null)} title="Переименовать материал" size="sm" footer={<>
        <Button variant="secondary" onClick={() => setRenameItem(null)} disabled={renameMaterial.isPending}>Отмена</Button>
        <Button type="submit" form="rename-workspace-material" loading={renameMaterial.isPending} disabled={!materialTitle.trim()}>Сохранить</Button>
      </>}>
        <form id="rename-workspace-material" onSubmit={saveMaterialRename}>
          <Field label="Название материала" required><TextInput autoFocus value={materialTitle} maxLength={300} onChange={(event) => setMaterialTitle(event.target.value)} /></Field>
        </form>
      </Modal>
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Переименовать папку" size="sm" footer={<><Button variant="secondary" onClick={() => setRenameOpen(false)}>Отмена</Button><Button type="submit" form="rename-workspace-folder" loading={rename.isPending} disabled={!renameValue.trim()}>Сохранить</Button></>}>
        <form id="rename-workspace-folder" onSubmit={saveRename}><Field label="Название папки" required><TextInput autoFocus value={renameValue} maxLength={120} onChange={(event) => setRenameValue(event.target.value)} /></Field></form>
      </Modal>
      <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={() => void confirmDelete()} title="Удалить папку?" message="Материалы останутся в своих системных разделах." confirmLabel="Удалить папку" danger loading={deleteFolder.isPending} />
      <ConfirmDialog open={Boolean(removeItem)} onClose={() => setRemoveItem(null)} onConfirm={() => void confirmRemove()} title="Убрать материал из папки?" message="Материал останется в рабочем пространстве." confirmLabel="Убрать" danger loading={detach.isPending} />
    </div>
  );
}
