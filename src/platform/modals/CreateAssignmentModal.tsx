import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { TagSearchField, type TagOption } from '../components/TagSearchField';
import {
  createTeacherAssignment,
  listAcademicYears,
  listClasses,
  listActiveSchoolSubjects,
} from '../services';
import type {
  AcademicYear,
  SchoolClass,
  SchoolSubject,
  TeacherProfile,
} from '../types';
import { formatPersonName } from '../types';

function describeAssignmentError(err: unknown): string {
  if (err instanceof ApiError && err.code === 'ASSIGNMENT_ALREADY_EXISTS') {
    return 'уже назначен этому классу';
  }
  return err instanceof Error ? err.message : 'не удалось назначить';
}

export function CreateAssignmentModal({
  open,
  onClose,
  teacher,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  teacher: TeacherProfile | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  /** Назначение на бэкенде — одна строка на предмет, поэтому выбор множественный, а запросов N. */
  const [pickedSubjects, setPickedSubjects] = useState<TagOption[]>([]);
  const [subjectQuery, setSubjectQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);

  useEffect(() => {
    if (!open) return;
    setYearId('');
    setClassId('');
    setPickedSubjects([]);
    setSubjectQuery('');
    setError(null);
    setLoadingMeta(true);
    void Promise.all([listAcademicYears(), listActiveSchoolSubjects()])
      .then(([y, s]) => {
        setYears(y);
        setSubjects(s);
        const active = y.find((item) => item.status === 'ACTIVE') ?? y[0];
        if (active) setYearId(active.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'))
      .finally(() => setLoadingMeta(false));
  }, [open, teacher]);

  useEffect(() => {
    if (!yearId) {
      setClasses([]);
      return;
    }
    void listClasses({ academicYearId: yearId })
      .then(setClasses)
      .catch(() => setClasses([]));
  }, [yearId]);

  const subjectOptions = useMemo(() => {
    const all: TagOption[] = subjects.map((s) => ({ id: String(s.id), label: s.name }));
    const q = subjectQuery.trim().toLowerCase();
    return q ? all.filter((s) => s.label.toLowerCase().includes(q)) : all;
  }, [subjects, subjectQuery]);

  /**
   * Предметы назначаются по одному запросу на предмет. Частичный успех — норма
   * (например, часть предметов уже назначена), поэтому уже созданные из выбора
   * убираем и оставляем модалку открытой с тем, что не прошло.
   */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!teacher) return;
    if (!yearId || !classId || pickedSubjects.length === 0) {
      setError('Заполните все поля');
      return;
    }
    setPending(true);
    setError(null);

    const created: TagOption[] = [];
    const failed: { subject: TagOption; message: string }[] = [];

    for (const subject of pickedSubjects) {
      try {
        await createTeacherAssignment({
          teacherProfileId: teacher.id,
          schoolSubjectId: Number(subject.id),
          classId: Number(classId),
          academicYearId: Number(yearId),
        });
        created.push(subject);
      } catch (err) {
        failed.push({ subject, message: describeAssignmentError(err) });
      }
    }

    setPending(false);

    if (created.length > 0) {
      toast.success(
        created.length === 1
          ? `Назначение создано: ${created[0].label}`
          : `Назначено предметов: ${created.length}`,
      );
      onSaved();
    }

    if (failed.length === 0) {
      onClose();
      return;
    }

    setPickedSubjects(failed.map((f) => f.subject));
    setError(failed.map((f) => `${f.subject.label} — ${f.message}`).join('; '));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Назначить предметы / класс"
      subtitle={
        teacher
          ? formatPersonName(teacher.lastName, teacher.firstName, teacher.middleName)
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending} disabled={loadingMeta}>
            Создать
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Учебный год" required>
          <Select value={yearId} onChange={(e) => setYearId(e.target.value)} required>
            <option value="">Выберите год</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Класс" required>
          <Select value={classId} onChange={(e) => setClassId(e.target.value)} required>
            <option value="">Выберите класс</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Предметы"
          required
          hint="Можно выбрать несколько — на каждый создастся отдельное назначение"
        >
          <TagSearchField
            value={pickedSubjects}
            onChange={setPickedSubjects}
            options={subjectOptions}
            query={subjectQuery}
            onQueryChange={setSubjectQuery}
            loading={loadingMeta}
            placeholder="Добавить предмет..."
          />
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
