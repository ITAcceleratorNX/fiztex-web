import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { useCreateWorkspaceFolder } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { WorkspaceFolder } from '@/lib/teacherWorkspaceApi';

export function CreateFolderModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: (folder: WorkspaceFolder) => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const create = useCreateWorkspaceFolder();
  const toast = useToast();
  const cleanName = name.trim();

  function close() {
    if (create.isPending) return;
    setName('');
    setError('');
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cleanName || cleanName.length > 120) return;
    try {
      const folder = await create.mutateAsync(cleanName);
      setName('');
      setError('');
      toast.success('Папка создана');
      onCreated(folder);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось создать папку');
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Новая папка"
      size="sm"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={close} disabled={create.isPending}>Отмена</Button>
          <Button type="submit" form="workspace-create-folder" loading={create.isPending} disabled={!cleanName || cleanName.length > 120}>Создать</Button>
        </>
      }
    >
      <form id="workspace-create-folder" onSubmit={submit}>
        <Field label="Название папки" required error={error || undefined}>
          <TextInput
            autoFocus
            value={name}
            onChange={(event) => { setName(event.target.value); setError(''); }}
            placeholder="Введите название"
            maxLength={120}
            className="h-12"
          />
        </Field>
      </form>
    </Modal>
  );
}
