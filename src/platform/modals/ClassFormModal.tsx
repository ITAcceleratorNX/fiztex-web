import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { useAdminHomeroomTeachers, useCreateSchoolClass } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { updateClass } from '../services';
import type { AcademicYear, SchoolClass } from '../types';
import { platformErrorMessage } from '../platformErrorMessage';

/**
 * Буква класса — любая буква Unicode (`\p{L}`), а не только латиница с русской
 * кириллицей: школе нужны казахские Ә, Ғ, Қ, Ң, Ө, Ұ, Ү, Һ, І, которых нет в
 * диапазоне А-Я. Бэкенд алфавит не ограничивает (`letter` — строка до 10 символов).
 */
function parseClassName(raw: string): { grade: string; letter: string } | null {
  const m = raw.trim().match(/^(\d+)\s*[«"']?\s*(\p{L})\s*[»"']?$/u);
  if (!m) return null;
  return { grade: m[1], letter: m[2].toUpperCase() };
}

export function ClassFormModal({
  open,
  onClose,
  years,
  defaultYearId,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  years: AcademicYear[];
  defaultYearId?: string;
  editing?: SchoolClass | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [displayName, setDisplayName] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [homeroomTeacherId, setHomeroomTeacherId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isEdit = Boolean(editing);
  const teachers = useAdminHomeroomTeachers(open && !isEdit);
  const createClass = useCreateSchoolClass();
  const selectedYear = years.find((year) => year.id === academicYearId);
  const canAssignTeacher = selectedYear?.status === 'ACTIVE';

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const match = editing.name.match(/^(\d+)(.*)$/);
      const grade = match?.[1] ?? '';
      const letter = (match?.[2] ?? '').trim();
      setDisplayName(grade && letter ? `${grade} «${letter}»` : editing.name);
      setAcademicYearId(editing.academicYearId);
    } else {
      setDisplayName('');
      setHomeroomTeacherId('');
      setAcademicYearId(
        defaultYearId || years.find((y) => y.status === 'ACTIVE')?.id || years[0]?.id || '',
      );
    }
    setError(null);
  }, [open, defaultYearId, years, editing]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseClassName(displayName);
    if (!parsed) {
      setError('Укажите класс в формате 5 «А»');
      return;
    }
    const name = `${parsed.grade}${parsed.letter}`;
    setPending(true);
    try {
      if (editing) {
        await updateClass(editing.id, {
          name,
          grade: parsed.grade,
          letter: parsed.letter,
        });
        toast.success(`Класс ${parsed.grade} «${parsed.letter}» обновлён`);
      } else {
        if (!academicYearId) {
          setError('Выберите учебный год');
          setPending(false);
          return;
        }
        const teacherId = canAssignTeacher && homeroomTeacherId
          ? Number(homeroomTeacherId)
          : undefined;
        await createClass.mutateAsync({
          name,
          academicYearId: Number(academicYearId),
          grade: parsed.grade,
          letter: parsed.letter,
          homeroomTeacherProfileId: teacherId,
        });
        toast.success(teacherId
          ? `Класс ${parsed.grade} «${parsed.letter}» создан, руководитель назначен`
          : `Класс ${parsed.grade} «${parsed.letter}» создан`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'HOMEROOM_ASSIGNMENT_CONFLICT'
        ? 'Не удалось назначить выбранного учителя. Класс не создан. Выберите другого учителя или создайте класс без руководителя.'
        : platformErrorMessage(err, 'Не удалось сохранить класс. Проверьте данные и попробуйте ещё раз.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Редактировать класс' : 'Создать класс'}
      subtitle={isEdit ? 'Измените название класса.' : 'Добавьте новый класс в выбранный учебный год.'}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Название класса" required hint="Например: 5 «А» или 7 «Ә»">
          <TextInput
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setError(null);
            }}
            placeholder="5 «А»"
            required
          />
        </Field>
        {!isEdit && (
          <Field label="Учебный год" required>
            <Select value={academicYearId} onChange={(e) => {
              setAcademicYearId(e.target.value);
              setHomeroomTeacherId('');
              setError(null);
            }}>
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {!isEdit && (
          <Field label="Классный руководитель" hint="Необязательно — можно назначить позже">
            <div className="space-y-2">
              <Select
                value={homeroomTeacherId}
                onChange={(e) => {
                  setHomeroomTeacherId(e.target.value);
                  setError(null);
                }}
                disabled={!canAssignTeacher || teachers.isPending || teachers.isError
                  || teachers.data?.length === 0 || pending}
                placeholder="Выберите учителя"
              >
                <option value="">Выберите учителя</option>
                {(teachers.data ?? []).map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {[teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ')}
                  </option>
                ))}
              </Select>
              {!canAssignTeacher && selectedYear && (
                <p className="text-xs text-muted">Руководителя можно назначить после активации учебного года.</p>
              )}
              {canAssignTeacher && teachers.isPending && (
                <p role="status" className="text-xs text-muted">Загрузка учителей…</p>
              )}
              {canAssignTeacher && teachers.isSuccess && teachers.data.length === 0 && (
                <p className="text-xs text-muted">Учителя не найдены</p>
              )}
              {canAssignTeacher && teachers.isError && (
                <div role="alert" className="flex items-center gap-2 text-xs text-no-lessons-fg">
                  <span>Не удалось загрузить учителей.</span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void teachers.refetch()}>
                    Повторить
                  </Button>
                </div>
              )}
            </div>
          </Field>
        )}
        <Field label="Статус класса" required>
          <Select value="ACTIVE" onChange={() => {}} disabled>
            <option value="ACTIVE">Активен</option>
          </Select>
        </Field>
        {error && <p role="alert" className="text-sm text-no-lessons-fg">{error}</p>}
      </form>
    </Modal>
  );
}
