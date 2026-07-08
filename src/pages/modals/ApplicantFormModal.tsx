import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea } from '@/components/ui/Field';
import { useCreateApplicant, useUpdateApplicant } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import type { Applicant } from '@/lib/types';

export function ApplicantFormModal({
  open,
  onClose,
  applicant,
}: {
  open: boolean;
  onClose: () => void;
  applicant: Applicant | null;
}) {
  const isEdit = Boolean(applicant);
  const create = useCreateApplicant();
  const update = useUpdateApplicant();
  const toast = useToast();

  const [childFullName, setChildFullName] = useState('');
  const [grade, setGrade] = useState('');
  const [parentFullName, setParentFullName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChildFullName(applicant?.childFullName ?? '');
    setGrade(applicant?.grade ?? '');
    setParentFullName(applicant?.parentFullName ?? '');
    setParentPhone(applicant?.parentPhone ?? '');
    setComment(applicant?.comment ?? '');
    setError(null);
  }, [open, applicant]);

  const pending = create.isPending || update.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!childFullName.trim()) {
      setError('Укажите ФИО поступающего');
      return;
    }
    if (!grade.trim()) {
      setError('Укажите класс поступления');
      return;
    }
    const body = {
      childFullName: childFullName.trim(),
      grade: grade.trim(),
      parentFullName: parentFullName.trim() || null,
      parentPhone: parentPhone.trim() || null,
      comment: comment.trim() || null,
    };
    try {
      if (isEdit && applicant) {
        await update.mutateAsync({ id: applicant.id, body });
        toast.success('Данные обновлены');
      } else {
        await create.mutateAsync(body);
        toast.success('Поступающий создан. Персональный код сгенерирован.');
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
      title={isEdit ? 'Редактировать поступающего' : 'Новый поступающий'}
      subtitle="Персональный код генерируется автоматически."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button form="applicant-form" type="submit" loading={pending}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <form id="applicant-form" onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="ФИО поступающего" required>
            <TextInput
              autoFocus
              value={childFullName}
              onChange={(e) => setChildFullName(e.target.value)}
              placeholder="Иванов Иван"
            />
          </Field>
          <Field label="Класс поступления" required>
            <TextInput value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="5 класс" />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="ФИО родителя" hint="Необязательно">
            <TextInput
              value={parentFullName}
              onChange={(e) => setParentFullName(e.target.value)}
              placeholder="Иванова Мария"
            />
          </Field>
          <Field label="Телефон родителя" hint="Необязательно">
            <TextInput
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              placeholder="+7 ..."
            />
          </Field>
        </div>
        <Field label="Комментарий администратора" hint="Внутреннее примечание">
          <TextArea value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
