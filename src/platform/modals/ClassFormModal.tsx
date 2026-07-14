import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { createClass } from '../services';
import type { AcademicYear, SchoolRecordStatus } from '../types';

export function ClassFormModal({
  open,
  onClose,
  years,
  defaultYearId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  years: AcademicYear[];
  defaultYearId?: string;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [status, setStatus] = useState<SchoolRecordStatus>('ACTIVE');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setAcademicYearId(defaultYearId || years.find((y) => y.status === 'ACTIVE')?.id || years[0]?.id || '');
    setStatus('ACTIVE');
    setError(null);
  }, [open, defaultYearId, years]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Укажите название класса');
      return;
    }
    if (!academicYearId) {
      setError('Выберите учебный год');
      return;
    }
    setPending(true);
    try {
      await createClass({ name, academicYearId, status });
      toast.success('Класс создан');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать класс');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Создать класс"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            Создать
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Название" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="7А" required />
        </Field>
        <Field label="Учебный год" required>
          <Select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Статус">
          <Select value={status} onChange={(e) => setStatus(e.target.value as SchoolRecordStatus)}>
            <option value="ACTIVE">Активен</option>
            <option value="ARCHIVED">Архив</option>
          </Select>
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
