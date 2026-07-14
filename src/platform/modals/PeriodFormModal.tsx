import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { PERIOD_TYPE_LABELS } from '../labels';
import { createPeriod, updatePeriod } from '../services';
import type {
  AcademicPeriod,
  AcademicPeriodStatus,
  AcademicPeriodType,
  AcademicYear,
} from '../types';

const TYPES: AcademicPeriodType[] = ['QUARTER', 'TRIMESTER', 'SEMESTER', 'CUSTOM'];

export function PeriodFormModal({
  open,
  onClose,
  period,
  years,
  defaultYearId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  period: AcademicPeriod | null;
  years: AcademicYear[];
  defaultYearId?: string;
  onSaved: () => void;
}) {
  const isEdit = Boolean(period);
  const toast = useToast();
  const [academicYearId, setAcademicYearId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AcademicPeriodType>('QUARTER');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<AcademicPeriodStatus>('ACTIVE');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAcademicYearId(
      period?.academicYearId ||
        defaultYearId ||
        years.find((y) => y.status === 'ACTIVE')?.id ||
        years[0]?.id ||
        '',
    );
    setName(period?.name ?? '');
    setType(period?.type ?? 'QUARTER');
    setStartDate(period?.startDate ?? '');
    setEndDate(period?.endDate ?? '');
    setStatus(period?.status ?? 'ACTIVE');
    setError(null);
  }, [open, period, defaultYearId, years]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Укажите название периода');
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
      if (isEdit && period) {
        await updatePeriod(period.id, { name, type, startDate, endDate, status });
        toast.success('Период обновлён');
      } else {
        if (!academicYearId) {
          setError('Выберите учебный год');
          setPending(false);
          return;
        }
        await createPeriod({ academicYearId, name, type, startDate, endDate, status });
        toast.success('Период создан');
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
      title={isEdit ? 'Редактировать период' : 'Добавить период'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            {isEdit ? 'Сохранить' : 'Добавить'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {!isEdit && (
          <Field label="Учебный год" required>
            <Select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Название" required hint="1 четверть, триместр, кастомный период">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Тип">
          <Select value={type} onChange={(e) => setType(e.target.value as AcademicPeriodType)}>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {PERIOD_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
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
          <Select value={status} onChange={(e) => setStatus(e.target.value as AcademicPeriodStatus)}>
            <option value="ACTIVE">Активен</option>
            <option value="DISABLED">Отключён</option>
            <option value="ARCHIVED">Архив</option>
          </Select>
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
