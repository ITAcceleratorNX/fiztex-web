import { useState, type FormEvent } from 'react';
import { Link2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { useAttachWorkspaceFolderItem, useCreateWorkspaceLink, useUploadWorkspaceFile } from '@/hooks/queries';
import { ApiError } from '@/lib/api';

const accept = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp';

export function CreateMaterialModal({ open, onClose, folderId }: {
  open: boolean;
  onClose: () => void;
  folderId?: number;
}) {
  const [mode, setMode] = useState<'choose' | 'upload' | 'link'>('choose');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [createdItemId, setCreatedItemId] = useState<number | null>(null);
  const upload = useUploadWorkspaceFile();
  const createLink = useCreateWorkspaceLink();
  const attach = useAttachWorkspaceFolderItem();
  const toast = useToast();
  const busy = upload.isPending || createLink.isPending || attach.isPending;

  function reset() {
    setMode('choose'); setFile(null); setTitle(''); setUrl(''); setComment('');
    setError(''); setCreatedItemId(null);
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    let persistedItemId = createdItemId;
    try {
      if (persistedItemId == null) {
        const material = mode === 'upload'
          ? file ? await upload.mutateAsync(file) : null
          : await createLink.mutateAsync({ title: title.trim(), url: url.trim(), comment: comment.trim() || undefined });
        persistedItemId = material?.workspaceItemId ?? null;
      }
      if (folderId != null && persistedItemId != null) {
        setCreatedItemId(persistedItemId);
        await attach.mutateAsync({ folderId, itemId: persistedItemId });
      }
      toast.success(folderId != null ? 'Материал добавлен в папку' : 'Материал добавлен');
      reset();
      onClose();
    } catch (caught) {
      setError(persistedItemId != null && folderId != null
        ? 'Материал сохранён в разделе «Документы и материалы», но не добавлен в папку. Повторите добавление.'
        : caught instanceof ApiError ? caught.message : 'Не удалось сохранить материал');
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={mode === 'upload' ? 'Загрузить файл' : mode === 'link' ? 'Внешний ресурс' : 'Добавить материал'}
      size="sm"
      footer={mode === 'choose' ? undefined : <>
        <Button variant="secondary" type="button" onClick={close} disabled={busy}>Отмена</Button>
        <Button type="submit" form="workspace-create-material" loading={busy} disabled={mode === 'upload' ? !file : !title.trim() || !url.trim()}>
          {createdItemId != null ? 'Повторить добавление' : mode === 'upload' ? 'Загрузить' : 'Добавить'}
        </Button>
      </>}
    >
      {mode === 'choose' ? <div className="grid gap-3">
        <button type="button" onClick={() => setMode('upload')} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"><UploadCloud className="size-5 text-navy-700" />Загрузить файл</button>
        <button type="button" onClick={() => setMode('link')} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"><Link2 className="size-5 text-navy-700" />Внешний ресурс</button>
      </div> : <form id="workspace-create-material" onSubmit={save} className="space-y-4">
        {mode === 'upload' ? <div>
          <FileDropzone file={file} onChange={(next) => { setFile(next); setError(''); }} disabled={busy || createdItemId != null} accept={accept} formatsLabel="PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, изображения — до 50 МБ" size="lg" />
          <p className="mt-2 text-xs text-slate-500">Видео не поддерживается.</p>
        </div> : <>
          <Field label="Название" required><TextInput value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} placeholder="Введите название" required disabled={busy || createdItemId != null} /></Field>
          <Field label="Ссылка" required><TextInput type="url" value={url} onChange={(event) => setUrl(event.target.value)} maxLength={2048} placeholder="https://" required disabled={busy || createdItemId != null} /></Field>
          <Field label="Комментарий"><TextArea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} placeholder="Необязательно" disabled={busy || createdItemId != null} /></Field>
        </>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>}
    </Modal>
  );
}
