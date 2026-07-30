import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Select, TextInput } from '@/components/ui/Field';
import { cx } from '@/lib/format';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import { WEEKDAY_LABELS, WEEKDAYS_ORDER } from '@/platform/labels';
import type {
  ConstructorContextGroupSet,
  ConstructorContextView,
  LessonPeriodSlot,
  ScheduleLesson,
  ScheduleLessonTarget,
} from '@/platform/services/schedules';
import { ModalCard, MODAL_PRIMARY, MODAL_SECONDARY } from './ModalCard';

export type LessonFormValues = {
  weekday: Weekday;
  lessonPeriodId: number;
  subjectId: number;
  teacherId: number;
  targetType: ScheduleLessonTarget;
  subgroupId: number | null;
  room: string | null;
};

/** Поле формы по 2015:15834: бокс 42px, radius 8, рамка #e5e7eb, текст 14px. */
const FIELD_BOX = 'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink';

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="text-13 font-semibold text-ink">
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </span>
  );
}

/**
 * Форма урока. Figma 2015:15829 — карточка 480, p 24, gap 20.
 *
 * День и слот звонков в макете вынесены в заголовок, а не в поля: модалка
 * всегда открывается из конкретной ячейки сетки. Селекты для них остаются
 * только на случай вызова без слота.
 */
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

  const slotKnown = Boolean(lockedSlot) || mode === 'edit';
  const period = periods.find((p) => String(p.id) === lessonPeriodId);

  // 2015:15831 — «Урок — Понедельник, №3 (09:50–10:30)»
  const title =
    slotKnown && period
      ? `Урок — ${WEEKDAY_LABELS[weekday] ?? weekday}, №${period.lessonNumber} (${period.startTime.slice(0, 5)}–${period.endTime.slice(0, 5)})`
      : mode === 'edit'
        ? 'Редактировать урок'
        : 'Добавить урок';

  async function handleSubmit() {
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
    <ModalCard
      open={open}
      onClose={onClose}
      labelledBy="lesson-title"
      className="max-w-[480px] gap-5 p-6"
    >
      {/* 2015:15830 — заголовок и подпись */}
      <div className="flex flex-col gap-1.5">
        <h2 id="lesson-title" className="text-lg font-bold text-ink">
          {title}
        </h2>
        <p className="text-sm text-muted">Заполните данные для урока</p>
      </div>

      {/* 2015:15833 — форма, gap 16 */}
      <div className="flex flex-col gap-4">
        {!slotKnown && (
          <>
            <div className="flex flex-col gap-1.5">
              <FieldLabel required>День</FieldLabel>
              <Select
                value={weekday}
                onChange={(e) => setWeekday(e.target.value as Weekday)}
                className={FIELD_BOX}
              >
                {dayOptions.map((d) => (
                  <option key={d} value={d}>
                    {WEEKDAY_LABELS[d]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel required>Слот звонков</FieldLabel>
              <Select
                value={lessonPeriodId}
                onChange={(e) => setLessonPeriodId(e.target.value)}
                className={FIELD_BOX}
              >
                <option value="">Выберите</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    Урок {p.lessonNumber} ({p.startTime.slice(0, 5)}–{p.endTime.slice(0, 5)})
                  </option>
                ))}
              </Select>
            </div>
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <FieldLabel required>Предмет</FieldLabel>
          <Select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={FIELD_BOX}
          >
            <option value="">Выберите</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        {/* 2015:15843 — у поля учителя иконка поиска внутри бокса */}
        <div className="flex flex-col gap-1.5">
          <FieldLabel required>Учитель</FieldLabel>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-gray-400" />
            <Select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className={cx(FIELD_BOX, 'pl-9')}
            >
              <option value="">Выберите</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* 2015:15853 — сегментированный переключатель вместо селекта */}
        <div className="flex flex-col gap-2">
          <FieldLabel required>Аудитория</FieldLabel>
          <div className="flex h-[38px] gap-0 rounded-lg border border-line bg-gray-50 p-[3px]">
            {(
              [
                ['CLASS', 'Весь класс'],
                ['SUBGROUP', 'Подгруппа'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTargetType(value)}
                className={cx(
                  'flex flex-1 items-center justify-center rounded-md text-13 transition',
                  targetType === value
                    ? 'bg-white font-semibold text-navy-700 shadow-[0_1px_1px_rgba(0,0,0,0.04)]'
                    : 'font-medium text-muted',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {targetType === 'SUBGROUP' && (
            <div className="pt-1">
              <Select
                value={subgroupId}
                onChange={(e) => setSubgroupId(e.target.value)}
                className={FIELD_BOX}
              >
                <option value="">Выберите подгруппу</option>
                {subgroups.map((sg) => (
                  <option key={sg.id} value={sg.id}>
                    {sg.groupSetName ? `${sg.groupSetName}: ${sg.name}` : sg.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Кабинет</FieldLabel>
          <TextInput
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Необязательно"
            className={FIELD_BOX}
          />
        </div>

        {error && <p className="text-13 text-red-600">{error}</p>}
      </div>

      {/* 2015:15870 — «Удалить урок» слева, действия справа */}
      <div className="flex items-center justify-between pt-3">
        {mode === 'edit' && onDelete ? (
          <button
            type="button"
            onClick={() => void onDelete()}
            disabled={pending}
            className="text-sm font-semibold text-red-500 transition hover:text-red-600 disabled:opacity-60"
          >
            Удалить урок
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={cx(MODAL_SECONDARY, 'text-muted')}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={pending}
            className={cx(
              MODAL_PRIMARY,
              'inline-flex items-center gap-2 bg-navy-700 hover:bg-navy-800',
            )}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Сохранить
          </button>
        </div>
      </div>
    </ModalCard>
  );
}
