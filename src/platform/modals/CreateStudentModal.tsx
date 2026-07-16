import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { createStudentWithAccount } from '../services';
import type { SchoolClass } from '../types';

export function CreateStudentModal({
  open,
  onClose,
  classes,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  classes: SchoolClass[];
  onSaved: () => void;
}) {
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [classId, setClassId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName('');
    setClassId('');
    setError(null);
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError('Укажите ФИО (Фамилия Имя)');
      return;
    }
    setPending(true);
    try {
      const result = await createStudentWithAccount({
        fullName,
        classId: classId ? Number(classId) : null,
      });
      const codeHint = result.issuedCode ? ` Код: ${result.issuedCode}` : '';
      toast.success(`Ученик создан.${classId ? ' Добавлен в класс.' : ''}${codeHint}`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Создать ученика"
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
        <Field
          label="ФИО"
          required
          hint="Формат: Фамилия Имя Отчество"
          error={error && !fullName.trim() ? error : undefined}
        >
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label="Класс" hint="Можно добавить позже">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Без класса</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.academicYearName})
              </option>
            ))}
          </Select>
        </Field>
        {error && fullName.trim() && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
