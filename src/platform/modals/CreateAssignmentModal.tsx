import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
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
  const [subjectId, setSubjectId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);

  useEffect(() => {
    if (!open) return;
    setYearId('');
    setClassId('');
    setSubjectId('');
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!teacher) return;
    if (!yearId || !classId || !subjectId) {
      setError('Заполните все поля');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await createTeacherAssignment({
        teacherProfileId: teacher.id,
        schoolSubjectId: Number(subjectId),
        classId: Number(classId),
        academicYearId: Number(yearId),
      });
      toast.success('Назначение создано');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать назначение');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Назначить предмет / класс"
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
        <Field label="Предмет" required>
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
            <option value="">Выберите предмет</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
