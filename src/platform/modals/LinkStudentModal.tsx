import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { SearchInput } from '@/components/ui/SearchInput';
import { useToast } from '@/context/ToastContext';
import { PARENT_RELATION_LABELS } from '../labels';
import { linkStudent, listStudents } from '../services';
import type { ParentProfile, ParentRelationType, StudentProfile } from '../types';
import { formatPersonName } from '../types';

const RELATIONS: ParentRelationType[] = ['MOTHER', 'FATHER', 'GUARDIAN', 'OTHER'];

export function LinkStudentModal({
  open,
  onClose,
  parent,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  parent: ParentProfile | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [studentId, setStudentId] = useState('');
  const [relation, setRelation] = useState<ParentRelationType>('MOTHER');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setStudentId('');
    setRelation('MOTHER');
    setError(null);
  }, [open, parent]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      setLoadingStudents(true);
      void listStudents({ name: query.trim() || undefined, status: 'ACTIVE' })
        .then(setStudents)
        .catch(() => setStudents([]))
        .finally(() => setLoadingStudents(false));
    }, query ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [open, query]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!parent) return;
    if (!studentId) {
      setError('Выберите ученика');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await linkStudent(parent.id, Number(studentId), relation);
      toast.success('Ученик привязан');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось привязать');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Привязать ученика"
      subtitle={
        parent
          ? formatPersonName(parent.lastName, parent.firstName, parent.middleName)
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            Привязать
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Поиск ученика">
          <SearchInput value={query} onChange={setQuery} placeholder="ФИО ученика" />
        </Field>
        <Field label="Ученик" required>
          <Select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            disabled={loadingStudents}
            required
          >
            <option value="">
              {loadingStudents ? 'Загрузка…' : 'Выберите ученика'}
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {formatPersonName(s.lastName, s.firstName, s.middleName)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Связь" required>
          <Select
            value={relation}
            onChange={(e) => setRelation(e.target.value as ParentRelationType)}
          >
            {RELATIONS.map((r) => (
              <option key={r} value={r}>
                {PARENT_RELATION_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
