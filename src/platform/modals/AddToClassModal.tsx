import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { addClassMembership, isDuplicateStudentError } from '../services';
import type { SchoolClass, StudentProfile } from '../types';
import { formatPersonName } from '../types';

export function AddToClassModal({
  open,
  onClose,
  student,
  classes,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  student: StudentProfile | null;
  classes: SchoolClass[];
  onSaved: () => void;
}) {
  const toast = useToast();
  const [classId, setClassId] = useState('');
  const [transfer, setTransfer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [needForce, setNeedForce] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClassId('');
    setTransfer(false);
    setError(null);
    setNeedForce(false);
  }, [open, student]);

  async function submit(force: boolean) {
    if (!student) return;
    if (!classId) {
      setError('Выберите класс');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await addClassMembership(student.id, Number(classId), { transfer, force });
      toast.success(force ? 'Ученик добавлен (force)' : 'Ученик добавлен в класс');
      onSaved();
      onClose();
    } catch (err) {
      if (isDuplicateStudentError(err) && !force) {
        setNeedForce(true);
        setError(
          'В классе уже есть ученик с похожим ФИО. Подтвердите добавление ещё раз.',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось добавить');
      }
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await submit(needForce);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить в класс"
      subtitle={
        student
          ? formatPersonName(student.lastName, student.firstName, student.middleName)
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            {needForce ? 'Добавить всё равно' : 'Добавить'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Класс" required>
          <Select value={classId} onChange={(e) => setClassId(e.target.value)} required>
            <option value="">Выберите класс</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.academicYearName})
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={transfer}
            onChange={(e) => setTransfer(e.target.checked)}
            className="rounded border-slate-300"
          />
          Перевод из другого класса того же года (transfer)
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
