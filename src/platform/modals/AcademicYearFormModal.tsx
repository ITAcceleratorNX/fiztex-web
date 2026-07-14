import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { createAcademicYear, updateAcademicYear } from '../services';
import type { AcademicYear, AcademicYearStatus } from '../types';

export function AcademicYearFormModal({
  open,
  onClose,
  year,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  year: AcademicYear | null;
  onSaved: () => void;
}) {
  const isEdit = Boolean(year);
  const toast = useToast();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<AcademicYearStatus>('DRAFT');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(year?.name ?? '');
    setStartDate(year?.startDate ?? '');
    setEndDate(year?.endDate ?? '');
    setStatus(year?.status ?? 'DRAFT');
    setError(null);
  }, [open, year]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Укажите название учебного года');
      return;
    }
    if (!startDate || !endDate) {
      setError('Укажите даты начала и окончания');
      return;
    }
    if (endDate < startDate) {
      setError('Дата окончания раньше даты начала');
      return;
    }

    setPending(true);
    try {
      if (isEdit && year) {
        await updateAcademicYear(year.id, { name, startDate, endDate, status });
        toast.success('Учебный год обновлён');
      } else {
        await createAcademicYear({ name, startDate, endDate, status });
        toast.success('Учебный год создан');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Редактировать учебный год' : 'Создать учебный год'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Название" required hint="Например, 2026/2027">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Дата начала" required>
            <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </Field>
          <Field label="Дата окончания" required>
            <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </Field>
        </div>
        <Field label="Статус">
          <Select value={status} onChange={(e) => setStatus(e.target.value as AcademicYearStatus)}>
            <option value="DRAFT">Черновик</option>
            <option value="ACTIVE">Активен</option>
            <option value="ARCHIVED">Архив</option>
          </Select>
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
