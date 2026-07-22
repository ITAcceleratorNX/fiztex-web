import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
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
  const [makeActive, setMakeActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(year?.name ?? '');
    setStartDate(year?.startDate ?? '');
    setEndDate(year?.endDate ?? '');
    setMakeActive(year?.status === 'ACTIVE');
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

    const resolvedStatus: AcademicYearStatus = (() => {
      if (makeActive) return 'ACTIVE';
      if (isEdit && year) {
        if (year.status === 'ARCHIVED') return 'ARCHIVED';
        if (year.status === 'ACTIVE') return 'DRAFT';
        return year.status;
      }
      return 'DRAFT';
    })();

    setPending(true);
    try {
      if (isEdit && year) {
        await updateAcademicYear(year.id, {
          name,
          startDate,
          endDate,
          status: resolvedStatus,
        });
        toast.success('Учебный год обновлён');
      } else {
        await createAcademicYear({ name, startDate, endDate, status: resolvedStatus });
        toast.success('Учебный год создан');
      }
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ANOTHER_YEAR_ACTIVE') {
        setError(
          'Другой учебный год уже активен. Сначала завершите его на главной, затем активируйте этот.',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось сохранить');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Редактировать учебный год' : 'Создать учебный год'}
      subtitle={
        isEdit
          ? 'Измените параметры учебного года.'
          : 'Укажите название и даты нового учебного года.'
      }
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Название учебного года" required>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="2027-2028"
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Дата начала" required>
            <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </Field>
          <Field label="Дата окончания" required>
            <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={makeActive}
            onChange={(e) => setMakeActive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400"
          />
          Сделать активным учебным годом
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
