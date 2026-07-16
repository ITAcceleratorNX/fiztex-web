import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { SCHOOL_STATUS_LABELS, WEEKDAY_LABELS } from '../labels';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import {
  archiveTeacherAssignment,
  archiveTeacherWorkingTime,
  createTeacherWorkingTime,
  getTeacher,
  listTeacherWorkingTime,
  updateTeacher,
  type TeacherWorkingTime,
} from '../services';
import type { TeacherProfile, TeacherProfileDetail } from '../types';
import { formatPersonName } from '../types';

const DAYS: Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export function TeacherDetailModal({
  open,
  onClose,
  teacher,
  onAssign,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  teacher: TeacherProfile | null;
  onAssign: () => void;
  onChanged?: () => void;
}) {
  const toast = useToast();
  const [detail, setDetail] = useState<TeacherProfileDetail | null>(null);
  const [workingTime, setWorkingTime] = useState<TeacherWorkingTime[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState<Weekday>('MONDAY');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('15:00');
  const [pendingWt, setPendingWt] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [pendingProfile, setPendingProfile] = useState(false);

  async function reload(teacherId: number) {
    setLoading(true);
    setError(null);
    try {
      const [d, wt] = await Promise.all([
        getTeacher(teacherId),
        listTeacherWorkingTime(teacherId),
      ]);
      setDetail(d);
      setWorkingTime(wt.filter((w) => w.status === 'ACTIVE'));
      setLastName(d.lastName);
      setFirstName(d.firstName);
      setMiddleName(d.middleName ?? '');
      setPhone(d.phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !teacher) return;
    setEditing(false);
    void reload(teacher.id);
  }, [open, teacher]);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!teacher) return;
    setPendingProfile(true);
    try {
      await updateTeacher(teacher.id, {
        lastName,
        firstName,
        middleName: middleName || null,
        phone,
      });
      toast.success('Профиль обновлён');
      setEditing(false);
      await reload(teacher.id);
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setPendingProfile(false);
    }
  }

  async function handleArchiveAssignment(id: number) {
    if (!window.confirm('Архивировать назначение?')) return;
    try {
      await archiveTeacherAssignment(id);
      toast.success('Назначение архивировано');
      if (teacher) await reload(teacher.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function onAddWorkingTime(e: FormEvent) {
    e.preventDefault();
    if (!teacher) return;
    setPendingWt(true);
    try {
      await createTeacherWorkingTime(teacher.id, {
        dayOfWeek: day,
        startTime: start.length === 5 ? `${start}:00` : start,
        endTime: end.length === 5 ? `${end}:00` : end,
      });
      toast.success('Интервал добавлен');
      await reload(teacher.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось добавить');
    } finally {
      setPendingWt(false);
    }
  }

  async function handleArchiveWt(id: number) {
    try {
      await archiveTeacherWorkingTime(id);
      toast.success('Интервал удалён');
      if (teacher) await reload(teacher.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  const title = teacher
    ? formatPersonName(teacher.lastName, teacher.firstName, teacher.middleName)
    : 'Учитель';

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
          <Button onClick={onAssign}>Назначить предмет</Button>
        </>
      }
    >
      {loading && <LoadingBlock label="Загрузка…" />}
      {error && !loading && <ErrorBlock message={error} />}
      {detail && !loading && (
        <div className="space-y-5 text-sm">
          {editing ? (
            <form onSubmit={onSaveProfile} className="space-y-3">
              <Field label="Фамилия" required>
                <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </Field>
              <Field label="Имя" required>
                <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </Field>
              <Field label="Отчество">
                <TextInput value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
              </Field>
              <Field label="Телефон" required>
                <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" loading={pendingProfile} size="sm">
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
                <dt className="text-xs text-slate-400">Телефон</dt>
                <dd>{detail.phone}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Статус</dt>
                <dd>{SCHOOL_STATUS_LABELS[detail.status]}</dd>
              </div>
            </dl>
          )}
          <p className="text-slate-500">
            Доступность (availability) — во вкладке «Учителя» в{' '}
            <Link to="/admin/schedule-settings" className="text-brand-600 underline">
              настройках расписания
            </Link>
            . Ниже — рабочие интервалы (working-time).
          </p>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Рабочее время
            </h3>
            <form onSubmit={onAddWorkingTime} className="mb-3 grid gap-2 sm:grid-cols-4">
              <Select value={day} onChange={(e) => setDay(e.target.value as Weekday)}>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {WEEKDAY_LABELS[d]}
                  </option>
                ))}
              </Select>
              <TextInput type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              <TextInput type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              <Button type="submit" loading={pendingWt} size="sm">
                Добавить
              </Button>
            </form>
            {workingTime.length === 0 ? (
              <p className="text-slate-500">Интервалов нет</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {workingTime.map((w) => (
                  <li key={w.id} className="flex items-center justify-between px-3 py-2">
                    <span>
                      {WEEKDAY_LABELS[w.dayOfWeek as Weekday] ?? w.dayOfWeek}:{' '}
                      {w.startTime.slice(0, 5)}–{w.endTime.slice(0, 5)}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => void handleArchiveWt(w.id)}>
                      Удалить
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Назначения
            </h3>
            {detail.assignments.filter((a) => a.status === 'ACTIVE').length === 0 ? (
              <EmptyBlock title="Нет назначений" description="Назначьте предмет и класс." />
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {detail.assignments
                  .filter((a) => a.status === 'ACTIVE')
                  .map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span>
                        {a.schoolSubjectName} · {a.className} · {a.academicYearName}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleArchiveAssignment(a.id)}
                      >
                        Архив
                      </Button>
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
