import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { createClass, updateClass } from '../services';
import type { AcademicYear, SchoolClass } from '../types';

function parseClassName(raw: string): { grade: string; letter: string } | null {
  const m = raw.trim().match(/^(\d+)\s*[«"']?\s*([A-Za-zА-Яа-яЁё])\s*[»"']?$/);
  if (!m) return null;
  return { grade: m[1], letter: m[2].toUpperCase() };
}

export function ClassFormModal({
  open,
  onClose,
  years,
  defaultYearId,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  years: AcademicYear[];
  defaultYearId?: string;
  editing?: SchoolClass | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [displayName, setDisplayName] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isEdit = Boolean(editing);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const match = editing.name.match(/^(\d+)(.*)$/);
      const grade = match?.[1] ?? '';
      const letter = (match?.[2] ?? '').trim();
      setDisplayName(grade && letter ? `${grade} «${letter}»` : editing.name);
      setAcademicYearId(editing.academicYearId);
    } else {
      setDisplayName('');
      setAcademicYearId(
        defaultYearId || years.find((y) => y.status === 'ACTIVE')?.id || years[0]?.id || '',
      );
    }
    setError(null);
  }, [open, defaultYearId, years, editing]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseClassName(displayName);
    if (!parsed) {
      setError('Укажите класс в формате 5 «А»');
      return;
    }
    const name = `${parsed.grade}${parsed.letter}`;
    setPending(true);
    try {
      if (editing) {
        await updateClass(editing.id, {
          name,
          grade: parsed.grade,
          letter: parsed.letter,
        });
        toast.success(`Класс ${parsed.grade} «${parsed.letter}» обновлён`);
      } else {
        if (!academicYearId) {
          setError('Выберите учебный год');
          setPending(false);
          return;
        }
        await createClass({
          name,
          academicYearId,
          grade: parsed.grade,
          letter: parsed.letter,
        });
        toast.success(`Класс ${parsed.grade} «${parsed.letter}» создан`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить класс');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Редактировать класс' : 'Создать класс'}
      subtitle="Добавьте новый класс в выбранный учебный год."
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
        <Field label="Название класса" required hint="Например: 5 «А»">
          <TextInput
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="5 «А»"
            required
          />
        </Field>
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
        <Field label="Статус класса" required>
          <Select value="ACTIVE" onChange={() => {}} disabled>
            <option value="ACTIVE">Активен</option>
          </Select>
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
