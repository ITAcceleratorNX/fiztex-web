import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import { WEEKDAY_LABELS, WEEKDAYS_ORDER } from '@/platform/labels';
import type {
  ConstructorContextGroupSet,
  ConstructorContextView,
  LessonPeriodSlot,
  ScheduleLesson,
  ScheduleLessonTarget,
} from '@/platform/services/schedules';

export type LessonFormValues = {
  weekday: Weekday;
  lessonPeriodId: number;
  subjectId: number;
  teacherId: number;
  targetType: ScheduleLessonTarget;
  subgroupId: number | null;
  room: string | null;
};

export function ScheduleLessonFormModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  pending,
  mode,
  initial,
  lockedSlot,
  periods,
  context,
  weekdays,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: LessonFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  pending?: boolean;
  mode: 'create' | 'edit';
  initial?: ScheduleLesson | null;
  lockedSlot?: { weekday: Weekday; lessonPeriodId: number } | null;
  periods: LessonPeriodSlot[];
  context: ConstructorContextView | null;
  weekdays?: Weekday[];
}) {
  const dayOptions = weekdays && weekdays.length > 0 ? weekdays : WEEKDAYS_ORDER;
  const [weekday, setWeekday] = useState<Weekday>('MONDAY');
  const [lessonPeriodId, setLessonPeriodId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [targetType, setTargetType] = useState<ScheduleLessonTarget>('CLASS');
  const [subgroupId, setSubgroupId] = useState('');
  const [room, setRoom] = useState('');
  const [error, setError] = useState<string | null>(null);

  const subgroups = useMemo(() => {
    const sets: ConstructorContextGroupSet[] = context?.groupSets ?? [];
    return sets.flatMap((gs) =>
      (gs.subgroups ?? []).map((sg) => ({ ...sg, groupSetName: gs.name })),
    );
  }, [context]);

  const subjects = context?.subjects ?? [];
  const teachers = useMemo(() => {
    const all = context?.teachers ?? [];
    if (!subjectId) return all;
    const sid = Number(subjectId);
    const filtered = all.filter((t) => t.subjectIds?.includes(sid));
    return filtered.length > 0 ? filtered : all;
  }, [context, subjectId]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && initial) {
      setWeekday(initial.weekday as Weekday);
      setLessonPeriodId(String(initial.lessonPeriodId));
      setSubjectId(String(initial.subjectId));
      setTeacherId(String(initial.teacherId));
      setTargetType(initial.targetType);
      setSubgroupId(initial.subgroupId != null ? String(initial.subgroupId) : '');
      setRoom(initial.room ?? '');
      return;
    }
    setWeekday(lockedSlot?.weekday ?? dayOptions[0] ?? 'MONDAY');
    setLessonPeriodId(lockedSlot ? String(lockedSlot.lessonPeriodId) : '');
    setSubjectId('');
    setTeacherId('');
    setTargetType('CLASS');
    setSubgroupId('');
    setRoom('');
  }, [open, mode, initial, lockedSlot, dayOptions]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!lessonPeriodId || !subjectId || !teacherId) {
      setError('Заполните обязательные поля');
      return;
    }
    if (targetType === 'SUBGROUP' && !subgroupId) {
      setError('Выберите подгруппу');
      return;
    }
    setError(null);
    await onSubmit({
      weekday,
      lessonPeriodId: Number(lessonPeriodId),
      subjectId: Number(subjectId),
      teacherId: Number(teacherId),
      targetType,
      subgroupId: targetType === 'SUBGROUP' ? Number(subgroupId) : null,
      room: room.trim() ? room.trim() : null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Редактировать урок' : 'Добавить урок'}
      footer={
        <>
          {mode === 'edit' && onDelete && (
            <Button
              variant="danger"
              onClick={() => void onDelete()}
              disabled={pending}
              className="mr-auto"
            >
              Удалить
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} loading={pending}>
            {mode === 'edit' ? 'Сохранить' : 'Добавить'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="День" required>
          <Select
            value={weekday}
            onChange={(e) => setWeekday(e.target.value as Weekday)}
            disabled={Boolean(lockedSlot) && mode === 'create'}
            required
          >
            {dayOptions.map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_LABELS[d]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Слот звонков" required>
          <Select
            value={lessonPeriodId}
            onChange={(e) => setLessonPeriodId(e.target.value)}
            disabled={Boolean(lockedSlot) && mode === 'create'}
            required
          >
            <option value="">Выберите</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                Урок {p.lessonNumber} ({p.startTime.slice(0, 5)}–{p.endTime.slice(0, 5)})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Предмет" required>
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
            <option value="">Выберите</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Учитель" required>
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required>
            <option value="">Выберите</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Аудитория" required>
          <Select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as ScheduleLessonTarget)}
          >
            <option value="CLASS">Весь класс</option>
            <option value="SUBGROUP">Подгруппа</option>
          </Select>
        </Field>
        {targetType === 'SUBGROUP' && (
          <Field label="Подгруппа" required>
            <Select value={subgroupId} onChange={(e) => setSubgroupId(e.target.value)} required>
              <option value="">Выберите</option>
              {subgroups.map((sg) => (
                <option key={sg.id} value={sg.id}>
                  {sg.groupSetName ? `${sg.groupSetName}: ${sg.name}` : sg.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Кабинет">
          <TextInput
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Необязательно"
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
