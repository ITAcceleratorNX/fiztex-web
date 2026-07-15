import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { DateRangeInput } from '@/components/ui/DateRangeInput';
import { EmptyBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { groupClassesByGrade } from '@/lib/platformCoreApi';
import type {
  CalendarEvent,
  CalendarEventEffect,
  CalendarEventScope,
  CalendarEventType,
} from '@/lib/scheduleSettingsTypes';
import {
  useCreateCalendarEvent,
  useSchoolClasses,
  useUpdateCalendarEvent,
} from '@/platform/hooks/useScheduleSettings';
import {
  CALENDAR_EVENT_EFFECT_LABELS,
  CALENDAR_EVENT_TYPE_LABELS,
} from '@/platform/labels';
import { ClassGradePicker } from './ClassGradePicker';
import { targetsFromEvent } from './calendarFormat';
import { mapCalendarEventApiError } from './calendarApiErrors';
import { cx } from '@/lib/format';

const EVENT_TYPES: CalendarEventType[] = [
  'HOLIDAY',
  'VACATION',
  'NON_SCHOOL_DAY',
  'EXAM_DAY',
  'OTHER',
];

type DateMode = 'single' | 'range';

export function CalendarEventFormModal({
  open,
  onClose,
  yearId,
  event,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  yearId: number;
  event: CalendarEvent | null;
  onSaved: () => void;
}) {
  const isEdit = event != null;
  const toast = useToast();
  const createMutation = useCreateCalendarEvent(yearId);
  const updateMutation = useUpdateCalendarEvent(yearId);
  const classesQuery = useSchoolClasses(open ? yearId : null);

  const [type, setType] = useState<CalendarEventType>('HOLIDAY');
  const [title, setTitle] = useState('');
  const [dateMode, setDateMode] = useState<DateMode>('single');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [scope, setScope] = useState<CalendarEventScope>('SCHOOL');
  const [grades, setGrades] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<Set<number>>(new Set());
  const [effect, setEffect] = useState<CalendarEventEffect>('NO_LESSONS');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const gradeGroups = useMemo(
    () => groupClassesByGrade(classesQuery.data?.content ?? []),
    [classesQuery.data],
  );
  const allGrades = useMemo(() => gradeGroups.map((g) => g.grade), [gradeGroups]);

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    setFormError(null);
    if (event) {
      setType(event.type);
      setTitle(event.title);
      setDateFrom(event.dateFrom);
      setDateTo(event.dateTo);
      setDateMode(event.dateFrom === event.dateTo ? 'single' : 'range');
      setScope(event.scope);
      setEffect(event.effect);
      const targets = targetsFromEvent(event.targets);
      setGrades(targets.grades);
      setClassIds(new Set(targets.classIds));
    } else {
      setType('HOLIDAY');
      setTitle('');
      setDateFrom('');
      setDateTo('');
      setDateMode('single');
      setScope('SCHOOL');
      setEffect('NO_LESSONS');
      setGrades([]);
      setClassIds(new Set());
    }
  }, [open, event]);

  function toggleGradeChip(grade: string) {
    setGrades((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade],
    );
  }

  function toggleClass(classId: number) {
    setClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  function toggleGradeClasses(ids: number[]) {
    setClassIds((prev) => {
      const next = new Set(prev);
      const allOn = ids.every((id) => next.has(id));
      if (allOn) for (const id of ids) next.delete(id);
      else for (const id of ids) next.add(id);
      return next;
    });
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = 'Укажите название';
    if (!dateFrom) errors.dateFrom = 'Укажите дату начала';
    const to = dateMode === 'single' ? dateFrom : dateTo;
    if (dateMode === 'range' && !dateTo) errors.dateTo = 'Укажите дату окончания';
    if (dateFrom && to && to < dateFrom) errors.dateTo = 'Дата окончания раньше начала';
    if (scope === 'GRADES' && grades.length === 0) {
      errors.targets = 'Выберите хотя бы одну параллель';
    }
    if (scope === 'CLASSES' && classIds.size === 0) {
      errors.targets = 'Выберите хотя бы один класс';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const to = dateMode === 'single' ? dateFrom : dateTo;
    const targets =
      scope === 'SCHOOL'
        ? null
        : scope === 'GRADES'
          ? { grades, classIds: undefined }
          : { grades: undefined, classIds: [...classIds] };

    try {
      if (isEdit && event) {
        await updateMutation.mutateAsync({
          id: event.id,
          body: {
            type,
            title: title.trim(),
            dateFrom,
            dateTo: to,
            effect,
            scope,
            targets,
          },
        });
        toast.success('Событие обновлено');
      } else {
        await createMutation.mutateAsync({
          academicYearId: yearId,
          type,
          title: title.trim(),
          dateFrom,
          dateTo: to,
          effect,
          scope,
          targets,
        });
        toast.success('Событие создано');
      }
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        const mapped = mapCalendarEventApiError(err.message);
        setFieldErrors({ ...mapped.fields });
        setFormError(mapped.form ?? null);
        return;
      }
      setFormError(err instanceof Error ? err.message : 'Не удалось сохранить');
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Редактирование события' : 'Новое событие календаря'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button type="submit" form="calendar-event-form" loading={pending}>
            Сохранить
          </Button>
        </>
      }
    >
      <form id="calendar-event-form" onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <Field label="Тип" required>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as CalendarEventType)}
            disabled={pending}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CALENDAR_EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Название" required error={fieldErrors.title}>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={pending}
            autoFocus
            error={Boolean(fieldErrors.title)}
          />
        </Field>

        <div>
          <p className="label-base mb-2">Даты</p>
          <div className="mb-3 flex gap-2">
            <ModeChip
              active={dateMode === 'single'}
              onClick={() => {
                setDateMode('single');
                setDateTo(dateFrom);
              }}
              label="Один день"
            />
            <ModeChip
              active={dateMode === 'range'}
              onClick={() => setDateMode('range')}
              label="Период"
            />
          </div>
          {dateMode === 'single' ? (
            <Field label="Дата" required error={fieldErrors.dateFrom}>
              <TextInput
                type="date"
                value={dateFrom}
                disabled={pending}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setDateTo(e.target.value);
                }}
              />
            </Field>
          ) : (
            <DateRangeInput
              from={dateFrom}
              to={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
              disabled={pending}
              error={fieldErrors.dateTo || fieldErrors.dateFrom}
            />
          )}
        </div>

        <div>
          <p className="label-base mb-2">Область применения</p>
          <div className="space-y-2">
            <RadioRow
              name="scope"
              checked={scope === 'SCHOOL'}
              onChange={() => setScope('SCHOOL')}
              label="Вся школа"
              hint="Событие видно всем классам года"
            />
            <RadioRow
              name="scope"
              checked={scope === 'GRADES'}
              onChange={() => setScope('GRADES')}
              label="Параллели"
              hint="Выбранные параллели (все классы внутри)"
            />
            <RadioRow
              name="scope"
              checked={scope === 'CLASSES'}
              onChange={() => setScope('CLASSES')}
              label="Классы"
              hint="Точечный выбор классов"
            />
          </div>
          {fieldErrors.targets && (
            <p className="mt-1 text-xs text-red-500">{fieldErrors.targets}</p>
          )}

          {scope === 'GRADES' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {allGrades.length === 0 && classesQuery.isLoading && (
                <LoadingBlock label="Классы…" />
              )}
              {allGrades.length === 0 && !classesQuery.isLoading && (
                <EmptyBlock title="Нет классов" description="Создайте классы для года." />
              )}
              {allGrades.map((grade) => {
                const on = grades.includes(grade);
                return (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => toggleGradeChip(grade)}
                    className={cx(
                      'rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition',
                      on
                        ? 'bg-brand-500 text-white ring-brand-500'
                        : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                    )}
                  >
                    {grade}
                  </button>
                );
              })}
            </div>
          )}

          {scope === 'CLASSES' && (
            <div className="mt-3">
              {classesQuery.isLoading && <LoadingBlock label="Классы…" />}
              {!classesQuery.isLoading && gradeGroups.length === 0 && (
                <EmptyBlock title="Нет классов" description="Создайте классы для года." />
              )}
              {gradeGroups.length > 0 && (
                <ClassGradePicker
                  gradeGroups={gradeGroups}
                  selectedClassIds={classIds}
                  onToggleClass={toggleClass}
                  onToggleGrade={toggleGradeClasses}
                  disabled={pending}
                />
              )}
            </div>
          )}
        </div>

        <div>
          <p className="label-base mb-2">Эффект</p>
          <div className="space-y-2">
            <RadioRow
              name="effect"
              checked={effect === 'NO_LESSONS'}
              onChange={() => setEffect('NO_LESSONS')}
              label={CALENDAR_EVENT_EFFECT_LABELS.NO_LESSONS}
              hint="В эти дни нельзя ставить уроки в расписание"
            />
            <RadioRow
              name="effect"
              checked={effect === 'INFO'}
              onChange={() => setEffect('INFO')}
              label={CALENDAR_EVENT_EFFECT_LABELS.INFO}
              hint="Только пометка в календаре, уроки допустимы"
            />
          </div>
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </form>
    </Modal>
  );
}

function ModeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-xl px-3 py-2 text-sm font-semibold transition',
        active
          ? 'bg-brand-500 text-white'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
      )}
    >
      {label}
    </button>
  );
}

function RadioRow({
  name,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-100 px-3 py-2.5 hover:bg-slate-50/80">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-1"
      />
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );
}
