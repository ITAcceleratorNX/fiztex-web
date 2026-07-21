import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { SearchInput } from '@/components/ui/SearchInput';
import { useToast } from '@/context/ToastContext';
import { PARENT_RELATION_LABELS } from '../labels';
import { linkStudent, listParents } from '../services';
import type { ParentProfile, ParentRelationType, StudentProfile } from '../types';
import { formatPersonName } from '../types';

const RELATIONS: ParentRelationType[] = ['MOTHER', 'FATHER', 'GUARDIAN', 'OTHER'];

export function LinkParentModal({
  open,
  onClose,
  student,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  student: StudentProfile | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [parentId, setParentId] = useState('');
  const [relation, setRelation] = useState<ParentRelationType>('MOTHER');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingParents, setLoadingParents] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setParentId('');
    setRelation('MOTHER');
    setError(null);
  }, [open, student]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      setLoadingParents(true);
      void listParents({ name: query.trim() || undefined })
        .then(setParents)
        .catch(() => setParents([]))
        .finally(() => setLoadingParents(false));
    }, query ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [open, query]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!student) return;
    if (!parentId) {
      setError('Выберите родителя');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await linkStudent(Number(parentId), student.id, relation);
      toast.success('Родитель привязан');
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
      title="Привязать родителя"
      subtitle={
        student ? formatPersonName(student.lastName, student.firstName, student.middleName) : undefined
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
        <Field label="Поиск родителя">
          <SearchInput value={query} onChange={setQuery} placeholder="ФИО родителя" />
        </Field>
        <Field label="Родитель" required>
          <Select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            disabled={loadingParents}
            required
          >
            <option value="">{loadingParents ? 'Загрузка…' : 'Выберите родителя'}</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPersonName(p.lastName, p.firstName, p.middleName)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Связь" required>
          <Select value={relation} onChange={(e) => setRelation(e.target.value as ParentRelationType)}>
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
