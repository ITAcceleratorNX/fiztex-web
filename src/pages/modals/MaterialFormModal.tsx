import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { useUpdateMaterial } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import type { Material } from '@/lib/types';

export function MaterialFormModal({
  open,
  onClose,
  subjectId,
  material,
}: {
  open: boolean;
  onClose: () => void;
  subjectId: number;
  material: Material | null;
}) {
  const update = useUpdateMaterial(subjectId);
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [visibleToStudents, setVisibleToStudents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && material) {
      setTitle(material.title);
      setTopic(material.topic ?? '');
      setDescription(material.description ?? '');
      setVisibleToStudents(material.visibleToStudents);
      setError(null);
    }
  }, [open, material]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!material) return;
    if (!title.trim()) {
      setError('Укажите название материала');
      return;
    }

    try {
      await update.mutateAsync({
        id: material.id,
        body: {
          title: title.trim(),
          topic: topic.trim() || null,
          description: description.trim() || null,
          visibleToStudents,
        },
      });
      toast.success('Материал обновлён');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Редактировать материал"
      subtitle={material?.originalFilename}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
            Отмена
          </Button>
          <Button form="material-form" type="submit" loading={update.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      <form id="material-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Название" required error={error ?? undefined}>
          <TextInput
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={Boolean(error)}
          />
        </Field>
        <Field label="Тема" hint="Необязательно">
          <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} />
        </Field>
        <Field label="Описание" hint="Необязательно">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Toggle
          checked={visibleToStudents}
          onChange={setVisibleToStudents}
          label="Виден ученикам"
        />
      </form>
    </Modal>
  );
}
