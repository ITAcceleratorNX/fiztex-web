import { PageHeader } from '@/components/ui/PageHeader';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FileText, Folder, Plus, Sparkles } from 'lucide-react';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
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
import { homeworkCardFromWorkspace } from '@/lib/homeworkListNavigation';
import { openWorkspaceDocument } from '@/lib/teacherWorkspaceOpen';
import { workspaceSectionLabel } from '@/lib/workspaceSections';
import { ROUTES } from '@/lib/routes';
import type { WorkspaceMaterialType, WorkspaceSearchItem } from '@/lib/teacherWorkspaceApi';
import { CreateMaterialModal } from './CreateMaterialModal';
import { CopyHomeworkToLessonModal } from './CopyHomeworkToLessonModal';
import { CreateLessonPreparationModal } from './CreateLessonPreparationModal';
import { DeleteMaterialModal } from './DeleteMaterialModal';
import { FolderMembershipModal } from './FolderMembershipModal';
import { FolderItemPickerModal } from './FolderItemPickerModal';
import { ReuseMaterialModal } from './ReuseMaterialModal';
import { ReuseTestTemplateModal } from './ReuseTestTemplateModal';
import { TestTemplateDetailModal } from './TestTemplateDetailModal';
import { ReuseLessonPreparationModal } from './ReuseLessonPreparationModal';
import { LessonPreparationDetailModal } from './LessonPreparationDetailModal';
import { TextbookDetailModal } from './TextbookDetailModal';
import { materialTypeLabels } from './materialTypeLabels';

const sectionTypes: Record<string, WorkspaceMaterialType | null> = {
  ACHIEVEMENTS: null,
  TEXTBOOKS: 'TEXTBOOK',
  CURRICULUM_PLANS: 'CURRICULUM_PLAN',
  PREPARED_LESSONS: 'PREPARED_LESSON',
  TESTS: 'TEST',
  HOMEWORK: 'HOMEWORK',
  DOCUMENTS: 'DOCUMENT',
};

const sectionDescriptions: Record<string, string> = {
  ACHIEVEMENTS: 'Медали, грамоты и другие достижения.',
  TEXTBOOKS: 'Личная библиотека учебников и источников для подготовки занятий.',
  CURRICULUM_PLANS: 'Планы тем и занятий по вашим предметам.',
  PREPARED_LESSONS: 'Создайте заготовку с темой, конспектом и материалами, затем подключайте её к нескольким урокам.',
  TESTS: 'Соберите вопросы один раз и используйте сохранённый тест в разных домашних заданиях.',
  HOMEWORK: 'Открывайте задания, проверяйте ответы или создавайте копии для других уроков.',
  DOCUMENTS: 'Загружайте файлы и сохраняйте ссылки, чтобы добавлять их к урокам и домашним заданиям.',
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
  const kindLabel = item.type === 'DOCUMENT' ? 'Ссылка' : (item.type && materialTypeLabels[item.type]) || 'Материал';
  return (
    <div className="flex min-h-20 items-center gap-3 border-b border-line px-4 py-4 last:border-b-0 sm:px-5">
      <span className="shrink-0">{format ? <FileTypeBadge format={format} /> : <Badge tone="navy">{kindLabel}</Badge>}</span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:underline">
        <span className="block break-words text-sm font-semibold leading-relaxed text-ink">{item.title}</span>
        <span className="mt-1 block text-13 text-muted">Добавлен {formatDate(item.addedAt)}</span>
        {item.author && <span className="mt-1 block break-words text-13 text-muted lg:hidden">Добавил: {item.author}</span>}
      </button>
      <span className="hidden w-44 shrink-0 items-center gap-2 break-words text-13 text-muted lg:flex">
        {item.author || '—'}
      </span>
      <ActionMenu triggerLabel="Действия" label={`Действия: ${item.title}`} items={[
        { label: 'Открыть', onSelect: onOpen },
        ...(item.sourceKind === 'teacher-workspace-material' ? [{ label: 'Переименовать', onSelect: onRename }] : []),
        { label: 'Добавить в папку / изменить папку', onSelect: onAddToFolder },
        ...(item.sourceKind === 'teacher-homework' && item.sourceId
          ? [{ label: 'Скопировать в другой урок', onSelect: onReuse }] : []),
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
  const location = useLocation();
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
  const [addingPreparation, setAddingPreparation] = useState(false);
  const [generatePreparation, setGeneratePreparation] = useState(false);
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
  const [textbookDetail, setTextbookDetail] = useState<WorkspaceSearchItem | null>(null);
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
      navigate(homeworkCardFromWorkspace(item.sourceId, location));
      return;
    }
    if (item.sourceKind === 'teacher-textbook') {
      setTextbookDetail(item);
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
  if (list.isPending || list.isError) return <div className="page-stack">
    <PageHeader title={title ?? (isFolder ? 'Личная папка' : workspaceSectionLabel(location.pathname) ?? 'Материалы')}
      back={{ to: ROUTES.workspace, label: 'Вернуться в рабочее пространство' }} />
    {list.isPending ? <LoadingBlock /> : <ErrorBlock message="Не удалось загрузить данные" onRetry={() => list.refetch()} />}
  </div>;

  return (
    <div className="page-stack">
      <Breadcrumbs items={[{ label: 'Рабочее пространство', to: ROUTES.workspace },
        { label: isFolder ? `Личная папка — ${title}` : title ?? 'Раздел' }]} />
      <PageHeader title={isFolder ? `Личная папка — ${title}` : title}
        back={{ to: ROUTES.workspace, label: 'Вернуться в рабочее пространство' }}
        description={isFolder ? 'Материалы из разных разделов, собранные в одном месте.' : sectionDescriptions[code]}
        actions={<>
          {(isFolder || code === 'DOCUMENTS') && <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Добавить материал</Button>}
          {!isFolder && code === 'PREPARED_LESSONS' && <>
            <Button size="sm" variant="secondary" icon={<Sparkles className="size-4" />}
              onClick={() => { setGeneratePreparation(true); setAddingPreparation(true); }}>Создать с ИИ</Button>
            <Button size="sm" icon={<Plus className="size-4" />}
              onClick={() => { setGeneratePreparation(false); setAddingPreparation(true); }}>Создать заготовку</Button>
          </>}
          {!isFolder && code === 'TESTS' && <Button size="sm" icon={<Plus className="size-4" />}
            onClick={() => navigate(ROUTES.workspaceTestNew, { state: { returnTo: location.pathname + location.search } })}>Создать тест</Button>}
          {isFolder && <ActionMenu label="Действия с папкой" items={[
            { label: 'Переименовать', onSelect: () => { setRenameValue(title ?? ''); setRenameOpen(true); } },
            { label: 'Удалить папку', onSelect: () => setDeleteOpen(true), danger: true },
          ]} />}
        </>} />
      {searchEnabled && search.isPending && <LoadingBlock />}
      {searchEnabled && search.isError && <ErrorBlock message="Не удалось загрузить данные" onRetry={() => search.refetch()} />}
      {(!searchEnabled || (!search.isError && !search.isPending)) && items.length === 0 && <div className="rounded-2xl border border-dashed border-line px-4 py-8">
        <EmptyBlock icon={isFolder ? <Folder className="size-8" /> : <FileText className="size-8" />} title={isFolder ? 'В этой папке пока нет материалов' : 'В этом разделе пока нет материалов'} />
      </div>}
      {!search.isError && items.length > 0 && <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex min-h-11 items-center rounded-t-2xl border-b border-line bg-canvas px-4 py-3 text-13 font-semibold text-muted sm:px-5">
          <span className="flex-1">Материалы · {total}</span><span className="hidden w-44 lg:block">Добавил</span><span className="w-28" />
        </div>
        {items.map((item) => item.id != null && <WorkspaceRow key={item.id} item={item} folderId={isFolder ? folderId : undefined} onOpen={() => void open(item)} onAddToFolder={() => setAddingToFolder(item)} onRemove={() => setRemoveItem(item)} onRename={() => { setRenameItem(item); setMaterialTitle(item.title ?? ''); }} onDelete={() => setDeleteItem(item)} onReuse={() => setReuseItem(item)} />)}
      </div>}
      {total > 20 && <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</Button>
        <Button variant="secondary" size="sm" disabled={(page + 1) * 20 >= total} onClick={() => setPage(page + 1)}>Далее</Button>
      </div>}
      <CreateMaterialModal open={adding} onClose={() => setAdding(false)} folderId={isFolder ? folderId : undefined}
        onPickExisting={isFolder ? () => setPickingExisting(true) : undefined} />
      {addingPreparation && <CreateLessonPreparationModal initialGenerate={generatePreparation}
        onClose={() => setAddingPreparation(false)} onCreated={() => setPage(0)} />}
      {isFolder && pickingExisting && <FolderItemPickerModal folderId={folderId} onClose={() => setPickingExisting(false)} />}
      <FolderMembershipModal item={addingToFolder} onClose={() => setAddingToFolder(null)} />
      <DeleteMaterialModal item={deleteItem} onClose={() => setDeleteItem(null)} />
      {reuseItem?.sourceKind === 'homework-test-template'
        ? <ReuseTestTemplateModal key={reuseItem.id} item={reuseItem} onClose={() => setReuseItem(null)} />
        : reuseItem?.sourceKind === 'lesson-preparation'
          ? <ReuseLessonPreparationModal key={reuseItem.id} item={reuseItem} onClose={() => setReuseItem(null)} />
          : reuseItem?.sourceKind === 'teacher-homework'
            ? <CopyHomeworkToLessonModal key={reuseItem.id} sourceId={Number(reuseItem.sourceId)} onClose={() => setReuseItem(null)}
              onCopied={(id) => { setReuseItem(null); navigate(homeworkCardFromWorkspace(id, location)); }} />
            : reuseItem && <ReuseMaterialModal key={reuseItem.id} item={reuseItem} onClose={() => setReuseItem(null)} />}
      {textbookDetail && <TextbookDetailModal key={textbookDetail.id} item={textbookDetail} onClose={() => setTextbookDetail(null)} />}
      {testDetail && <TestTemplateDetailModal key={testDetail.id} item={testDetail} origin={location} onClose={() => setTestDetail(null)}
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
