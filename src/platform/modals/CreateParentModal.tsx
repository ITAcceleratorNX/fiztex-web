import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { TagSearchField, type TagOption } from '../components/TagSearchField';
import { createUser, linkStudent, listStudents } from '../services';
import { formatPersonName } from '../types';
import {
  formatPhoneMask,
  isPhoneComplete,
  toastCreatedMessage,
} from './createUserHelpers';

export function CreateParentModal({
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
  const [linked, setLinked] = useState<TagOption[]>([]);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<TagOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName('');
    setPhone('');
    setEmail('');
    setComment('');
    setLinked([]);
    setQuery('');
    setOptions([]);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      setLoadingStudents(true);
      void listStudents({ name: query.trim() || undefined })
        .then((students) =>
          setOptions(
            students.map((s) => ({
              id: String(s.id),
              label: formatPersonName(s.lastName, s.firstName, s.middleName),
            })),
          ),
        )
        .catch(() => setOptions([]))
        .finally(() => setLoadingStudents(false));
    }, query ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [open, query]);

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
        role: 'PARENT',
        phone: phone.trim(),
        email: email.trim() || undefined,
      });

      if (created.schoolProfileId != null && linked.length > 0) {
        for (const student of linked) {
          try {
            await linkStudent(created.schoolProfileId, Number(student.id), 'OTHER');
          } catch {
            // Link is best-effort after account create.
          }
        }
      }

      toast.success(toastCreatedMessage('Родитель', created.issuedCode));
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать родителя');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Создать родителя"
      subtitle="Заполните данные родителя для привязки к ученикам"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            Создать родителя
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="ФИО" required>
          <TextInput
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Иванов Пётр Сидорович"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Телефон" required>
            <TextInput
              value={phone}
              onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
              placeholder="+7 (___) ___-__-__"
              inputMode="tel"
              required
            />
          </Field>
          <Field label="Email">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </Field>
        </div>

        <Field label="Связанный ученик">
          <TagSearchField
            value={linked}
            onChange={setLinked}
            options={options}
            query={query}
            onQueryChange={setQuery}
            loading={loadingStudents}
            placeholder="Поиск по ФИО ученика..."
          />
        </Field>

        <Field label="Комментарий">
          <TextArea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Укажите степень родства или другие примечания..."
            rows={3}
          />
        </Field>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
