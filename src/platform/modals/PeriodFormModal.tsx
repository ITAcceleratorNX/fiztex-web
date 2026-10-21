import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/context/ToastContext';
import { PERIOD_TYPE_LABELS } from '../labels';
import { useSaveAcademicPeriod } from '@/hooks/queries';
import { platformErrorMessage } from '../platformErrorMessage';
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
  const save = useSaveAcademicPeriod();
  const [academicYearId, setAcademicYearId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AcademicPeriodType>('QUARTER');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pending = save.isPending;

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
    setActive(period ? period.status === 'ACTIVE' : true);
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

    const status: AcademicPeriodStatus = active ? 'ACTIVE' : 'DISABLED';

    try {
      if (isEdit && period) {
        await save.mutateAsync({ periodId: period.id, input: { name, type, startDate, endDate, status } });
        toast.success('Период обновлён');
      } else {
        if (!academicYearId) {
          setError('Выберите учебный год');
          return;
        }
        await save.mutateAsync({ input: { academicYearId, name, type, startDate, endDate, status } });
        toast.success('Период создан');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(platformErrorMessage(err, 'Не удалось сохранить период. Проверьте данные и попробуйте ещё раз.'));
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!pending) onClose(); }}
      title={isEdit ? 'Редактировать период' : 'Создать период'}
      subtitle="Настройте параметры учебного периода."
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
        <Field label="Тип периода" required>
          <Select value={type} onChange={(e) => setType(e.target.value as AcademicPeriodType)}>
            <option value="" disabled>
              Выберите тип
            </option>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {value === 'CUSTOM' ? 'Свой период' : PERIOD_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Название периода" required>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="1 четверть"
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
        <Toggle checked={active} onChange={setActive} disabled={pending} label="Период активен"
          description="Активные периоды доступны в журнале и расписании. Выключенный период не предлагается для новых занятий." />
        {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
      </form>
    </Modal>
  );
}
