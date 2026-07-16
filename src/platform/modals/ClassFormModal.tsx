import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { createClass, updateClass } from '../services';
import type { AcademicYear, SchoolClass } from '../types';

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
  const [grade, setGrade] = useState('');
  const [letter, setLetter] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isEdit = Boolean(editing);
  const name = `${grade.trim()}${letter.trim()}`;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const match = editing.name.match(/^(\d+)(.*)$/);
      setGrade(match?.[1] ?? '');
      setLetter((match?.[2] ?? '').trim());
      setAcademicYearId(editing.academicYearId);
    } else {
      setGrade('');
      setLetter('');
      setAcademicYearId(
        defaultYearId || years.find((y) => y.status === 'ACTIVE')?.id || years[0]?.id || '',
      );
    }
    setError(null);
  }, [open, defaultYearId, years, editing]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!grade.trim() || !letter.trim()) {
      setError('Укажите параллель и букву класса');
      return;
    }
    setPending(true);
    try {
      if (editing) {
        await updateClass(editing.id, {
          name,
          grade: grade.trim(),
          letter: letter.trim().toUpperCase(),
        });
        toast.success(`Класс «${name}» обновлён`);
      } else {
        if (!academicYearId) {
          setError('Выберите учебный год');
          setPending(false);
          return;
        }
        await createClass({
          name,
          academicYearId,
          grade: grade.trim(),
          letter: letter.trim().toUpperCase(),
        });
        toast.success(`Класс «${name}» создан`);
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
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            Сохранить
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Параллель" required hint="Например, 5">
            <TextInput value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="5" required />
          </Field>
          <Field label="Буква" required hint="Например, А">
            <TextInput
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              placeholder="А"
              maxLength={2}
              required
            />
          </Field>
        </div>
        <Field label="Название" hint="Собирается автоматически">
          <TextInput value={name || '—'} disabled readOnly />
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
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
