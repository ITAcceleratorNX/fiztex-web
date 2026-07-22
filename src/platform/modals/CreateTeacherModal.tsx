import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { TagSearchField, type TagOption } from '../components/TagSearchField';
import { createUser, listActiveSchoolSubjects } from '../services';
import {
  formatPhoneMask,
  isPhoneComplete,
  toastCreatedMessage,
} from './createUserHelpers';

export function CreateTeacherModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [subjects, setSubjects] = useState<TagOption[]>([]);
  const [allSubjects, setAllSubjects] = useState<TagOption[]>([]);
  const [query, setQuery] = useState('');
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName('');
    setPhone('');
    setEmail('');
    setComment('');
    setSubjects([]);
    setQuery('');
    setError(null);
    setLoadingSubjects(true);
    void listActiveSchoolSubjects()
      .then((list) =>
        setAllSubjects(list.map((s) => ({ id: String(s.id), label: s.name }))),
      )
      .catch(() => setAllSubjects([]))
      .finally(() => setLoadingSubjects(false));
  }, [open]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSubjects;
    return allSubjects.filter((s) => s.label.toLowerCase().includes(q));
  }, [allSubjects, query]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError('Укажите ФИО');
      return;
    }
    if (!isPhoneComplete(phone)) {
      setError('Укажите телефон');
      return;
    }

    setPending(true);
    try {
      const created = await createUser({
        fullName: fullName.trim(),
        role: 'TEACHER',
        phone: phone.trim(),
        email: email.trim() || undefined,
      });

      toast.success(
        subjects.length > 0
          ? `${toastCreatedMessage('Учитель', created.issuedCode)}. Предметы можно назначить в профиле.`
          : toastCreatedMessage('Учитель', created.issuedCode),
      );
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать учителя');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Создать учителя"
      subtitle="Добавьте нового учителя и назначьте предметы"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            Создать
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="ФИО" required>
          <TextInput
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Васильева Анна Ивановна"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Телефон" required>
            <TextInput
              value={phone}
              onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
              placeholder="+7 (777) 987-65-43"
              inputMode="tel"
              required
            />
          </Field>
          <Field label="Email">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@phystech.edu"
            />
          </Field>
        </div>

        <Field label="Предмет">
          <TagSearchField
            value={subjects}
            onChange={setSubjects}
            options={filteredOptions}
            query={query}
            onQueryChange={setQuery}
            loading={loadingSubjects}
            placeholder="Добавить предмет..."
          />
        </Field>

        <Field label="Комментарий">
          <TextArea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Введите комментарий..."
            rows={3}
          />
        </Field>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
