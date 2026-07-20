import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field';
import { useCreateSubject, useUpdateSubject } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import type { Subject, SubjectStatus } from '@/lib/types';
import { SUBJECT_MAX_DESCRIPTION_LENGTH, SUBJECT_MAX_NAME_LENGTH } from './subjectConstraints';
import { charCounterText, mapSubjectApiError } from './subjectFormHelpers';

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
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; description?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(subject?.name ?? '');
      setDescription(subject?.description ?? '');
      setStatus(subject?.status ?? 'ACTIVE');
      setFieldErrors({});
      setFormError(null);
    }
  }, [open, subject]);

  const pending = create.isPending || update.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFieldErrors({ name: 'Укажите название предмета' });
      setFormError(null);
      return;
    }
    const body = { name: name.trim(), description: description.trim() || null, status };
    setFieldErrors({});
    setFormError(null);
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
      const mapped = mapSubjectApiError(err);
      setFieldErrors(mapped.fields);
      setFormError(mapped.form ?? null);
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
        {formError && !fieldErrors.name && !fieldErrors.description ? (
          <p className="text-xs text-red-500">{formError}</p>
        ) : null}
        <Field label="Название" required error={fieldErrors.name}>
          <TextInput
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Математика"
            maxLength={SUBJECT_MAX_NAME_LENGTH}
            error={Boolean(fieldErrors.name)}
          />
          <p className="mt-1 text-xs text-slate-400">
            {charCounterText(name.length, SUBJECT_MAX_NAME_LENGTH)}
          </p>
        </Field>
        <Field label="Описание" hint="Необязательно" error={fieldErrors.description}>
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Краткое описание предмета"
            maxLength={SUBJECT_MAX_DESCRIPTION_LENGTH}
            error={Boolean(fieldErrors.description)}
          />
          <p className="mt-1 text-xs text-slate-400">
            {charCounterText(description.length, SUBJECT_MAX_DESCRIPTION_LENGTH)}
          </p>
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
