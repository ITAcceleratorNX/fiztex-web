import { useEffect, useState, type FormEvent } from 'react';
import { Calendar } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import {
  addClassMembership,
  createUser,
  listAcademicYears,
  listClasses,
  updateStudent,
} from '../services';
import type { AcademicYear, SchoolClass } from '../types';
import {
  ENTRY_GRADES,
  formatPhoneMask,
  toastCreatedMessage,
} from './createUserHelpers';

export function CreateStudentModal({
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
  const [birthDate, setBirthDate] = useState('');
  const [grade, setGrade] = useState('5');
  const [yearId, setYearId] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName('');
    setBirthDate('');
    setGrade('5');
    setYearId('');
    setPhone('');
    setComment('');
    setError(null);
    setLoadingMeta(true);
    void listAcademicYears()
      .then((list) => {
        setYears(list);
        const active = list.find((y) => y.status === 'ACTIVE') ?? list[0];
        if (active) setYearId(active.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить годы'))
      .finally(() => setLoadingMeta(false));
  }, [open]);

  useEffect(() => {
    if (!open || !yearId) {
      setClasses([]);
      return;
    }
    void listClasses({ academicYearId: yearId })
      .then(setClasses)
      .catch(() => setClasses([]));
  }, [open, yearId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError('Укажите ФИО');
      return;
    }
    if (!grade) {
      setError('Укажите класс поступления');
      return;
    }
    if (!yearId) {
      setError('Укажите учебный год');
      return;
    }

    setPending(true);
    try {
      const created = await createUser({
        fullName: fullName.trim(),
        role: 'STUDENT',
        phone: phone.trim() || undefined,
      });

      if (created.schoolProfileId != null) {
        if (birthDate) {
          await updateStudent(created.schoolProfileId, { birthDate });
        }

        // If exactly one class of this parallel exists in the year, enroll; otherwise leave for profile.
        const gradeMatches = classes.filter((c) => {
          const m = c.name.trim().match(/^(\d+)/);
          return m?.[1] === grade;
        });
        if (gradeMatches.length === 1) {
          try {
            await addClassMembership(created.schoolProfileId, Number(gradeMatches[0].id));
          } catch {
            // Membership is best-effort; account already created.
          }
        }
      }

      toast.success(toastCreatedMessage('Ученик', created.issuedCode));
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать ученика');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Создать ученика"
      subtitle="Заполните основную информацию об ученике"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            Создать ученика
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="ФИО" required>
          <TextInput
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Фамилия Имя Отчество"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Дата рождения">
            <div className="relative">
              <TextInput
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="pr-10"
              />
              <Calendar className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </Field>
          <Field label="Класс поступления" required>
            <Select value={grade} onChange={(e) => setGrade(e.target.value)} disabled={loadingMeta}>
              {ENTRY_GRADES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Учебный год" required>
            <Select value={yearId} onChange={(e) => setYearId(e.target.value)} disabled={loadingMeta}>
              <option value="">{loadingMeta ? 'Загрузка…' : 'Выберите год'}</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Телефон">
            <TextInput
              value={phone}
              onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
              placeholder="+7 (___) ___-__-__"
              inputMode="tel"
            />
          </Field>
        </div>

        <Field label="Комментарий">
          <TextArea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Дополнительная информация..."
            rows={3}
          />
        </Field>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
