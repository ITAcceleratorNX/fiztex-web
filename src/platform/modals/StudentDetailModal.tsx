import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { SCHOOL_STATUS_LABELS, STUDENT_STATUS_LABELS } from '../labels';
import { getStudent, updateStudent } from '../services';
import type { StudentProfile, StudentProfileDetail } from '../types';
import { formatPersonName } from '../types';

export function StudentDetailModal({
  open,
  onClose,
  student,
  onAddToClass,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  student: StudentProfile | null;
  onAddToClass: () => void;
  onChanged?: () => void;
}) {
  const toast = useToast();
  const [detail, setDetail] = useState<StudentProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open || !student) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEditing(false);
    void getStudent(student.id)
      .then((d) => {
        if (!cancelled) {
          setDetail(d);
          setLastName(d.lastName);
          setFirstName(d.firstName);
          setMiddleName(d.middleName ?? '');
          setBirthDate(d.birthDate ?? '');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, student]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!student) return;
    setPending(true);
    try {
      const updated = await updateStudent(student.id, {
        lastName,
        firstName,
        middleName: middleName || null,
        birthDate: birthDate || null,
      });
      setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditing(false);
      toast.success('Профиль обновлён');
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setPending(false);
    }
  }

  const title = student
    ? formatPersonName(student.lastName, student.firstName, student.middleName)
    : 'Ученик';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
          {!editing && (
            <Button variant="secondary" onClick={() => setEditing(true)} disabled={!detail}>
              Изменить
            </Button>
          )}
          <Button onClick={onAddToClass}>Добавить в класс</Button>
        </>
      }
    >
      {loading && <LoadingBlock label="Загрузка…" />}
      {error && !loading && <ErrorBlock message={error} />}
      {detail && !loading && (
        <div className="space-y-4 text-sm">
          {editing ? (
            <form onSubmit={onSave} className="space-y-3">
              <Field label="Фамилия" required>
                <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </Field>
              <Field label="Имя" required>
                <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </Field>
              <Field label="Отчество">
                <TextInput value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
              </Field>
              <Field label="Дата рождения">
                <TextInput
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" loading={pending} size="sm">
                  Сохранить
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  Отмена
                </Button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-slate-400">Статус</dt>
                <dd>{STUDENT_STATUS_LABELS[detail.status]}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Account ID</dt>
                <dd>{detail.accountId}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-400">Текущий класс</dt>
                <dd>
                  {detail.currentMembership
                    ? `${detail.currentMembership.className} (${detail.currentMembership.academicYearName})`
                    : 'Не назначен'}
                </dd>
              </div>
            </dl>
          )}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              История классов
            </h3>
            {detail.membershipHistory.length === 0 ? (
              <p className="text-slate-500">Пока нет записей</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {detail.membershipHistory.map((m) => (
                  <li key={m.id} className="flex justify-between px-3 py-2">
                    <span>
                      {m.className} · {m.academicYearName}
                    </span>
                    <span className="text-slate-500">{SCHOOL_STATUS_LABELS[m.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
