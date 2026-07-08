import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field';
import { useCreateSubject, useUpdateSubject } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import type { Subject, SubjectStatus } from '@/lib/types';

export function SubjectFormModal({
  open,
  onClose,
  subject,
}: {
  open: boolean;
  onClose: () => void;
  subject: Subject | null;
}) {
  const isEdit = Boolean(subject);
  const create = useCreateSubject();
  const update = useUpdateSubject();
  const toast = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<SubjectStatus>('ACTIVE');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(subject?.name ?? '');
      setDescription(subject?.description ?? '');
      setStatus(subject?.status ?? 'ACTIVE');
      setError(null);
    }
  }, [open, subject]);

  const pending = create.isPending || update.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Укажите название предмета');
      return;
    }
    const body = { name: name.trim(), description: description.trim() || null, status };
    try {
      if (isEdit && subject) {
        await update.mutateAsync({ id: subject.id, body });
        toast.success('Предмет обновлён');
      } else {
        await create.mutateAsync(body);
        toast.success('Предмет создан');
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Редактировать предмет' : 'Новый предмет'}
      subtitle="Предмет используется как справочник для тестов."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button form="subject-form" type="submit" loading={pending}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <form id="subject-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Название" required error={error ?? undefined}>
          <TextInput
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Математика"
            error={Boolean(error)}
          />
        </Field>
        <Field label="Описание" hint="Необязательно">
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Краткое описание предмета"
          />
        </Field>
        <Field label="Статус" hint="Скрытый предмет нельзя выбрать при создании новых тестов.">
          <Select value={status} onChange={(e) => setStatus(e.target.value as SubjectStatus)}>
            <option value="ACTIVE">Активен</option>
            <option value="HIDDEN">Скрыт</option>
          </Select>
        </Field>
      </form>
    </Modal>
  );
}
