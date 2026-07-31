import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import { groupClassesByGrade } from '@/lib/platformCoreApi';
import type {
  CalendarEvent,
  CalendarEventEffect,
  CalendarEventScope,
  CalendarEventType,
  GradeClassGroup,
} from '@/lib/scheduleSettingsTypes';
import {
  useCreateCalendarEvent,
  useSchoolClasses,
  useUpdateCalendarEvent,
} from '@/platform/hooks/useScheduleSettings';
import { CALENDAR_EVENT_TYPE_LABELS } from '@/platform/labels';
import { EVENT_TYPE_ORDER } from './calendarBadges';
import { targetsFromEvent } from './calendarFormat';
import { mapCalendarEventApiError } from './calendarApiErrors';

type DateMode = 'single' | 'range';
/** В макете два таба; GRADES выводится из того, что параллель отмечена целиком. */
type ScopeTab = 'SCHOOL' | 'CLASSES';

const REQUIRED = 'Обязательное поле';

/**
 * «Новое событие» (Figma 2015:10714; состояние с ошибками — 2015:10581).
 *
 * Диалог собран здесь, а не на общем Modal: в макете нет ни разделителей,
 * ни крестика, а ширина 480 не совпадает ни с одним размером общего компонента.
 */
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
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const createMutation = useCreateCalendarEvent(yearId);
  const updateMutation = useUpdateCalendarEvent(yearId);
  const classesQuery = useSchoolClasses(open ? yearId : null);

  const [type, setType] = useState<CalendarEventType | ''>('');
  const [title, setTitle] = useState('');
  const [dateMode, setDateMode] = useState<DateMode>('single');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [scopeTab, setScopeTab] = useState<ScopeTab>('SCHOOL');
  const [classIds, setClassIds] = useState<Set<number>>(new Set());
  const [effect, setEffect] = useState<CalendarEventEffect>('NO_LESSONS');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const gradeGroups = useMemo(
    () => groupClassesByGrade(classesQuery.data?.content ?? []),
    [classesQuery.data],
  );

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
      setEffect(event.effect);
      setScopeTab(event.scope === 'SCHOOL' ? 'SCHOOL' : 'CLASSES');
    } else {
      setType('');
      setTitle('');
      setDateFrom('');
      setDateTo('');
      setDateMode('single');
      setEffect('NO_LESSONS');
      setScopeTab('SCHOOL');
      setClassIds(new Set());
    }
  }, [open, event]);

  // Классы приезжают асинхронно: GRADES-событие раскрывается в свои классы
  // только когда список параллелей уже известен.
  useEffect(() => {
    if (!open || !event || gradeGroups.length === 0) return;
    const targets = targetsFromEvent(event.targets);
    if (event.scope === 'GRADES') {
      const ids = gradeGroups
        .filter((g) => targets.grades.includes(g.grade))
        .flatMap((g) => g.classes.map((c) => c.id));
      setClassIds(new Set(ids));
    } else if (event.scope === 'CLASSES') {
      setClassIds(new Set(targets.classIds));
    } else {
      setClassIds(new Set());
    }
  }, [open, event, gradeGroups]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => firstFieldRef.current?.focus(), 0);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(focusTimer);
      restoreFocusRef.current?.focus();
    };
  }, [open, onClose]);

  function toggleClass(classId: number) {
    setClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  function toggleGrade(ids: number[]) {
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
    if (!title.trim()) errors.title = REQUIRED;
    if (!type) errors.type = REQUIRED;
    if (!dateFrom) errors.dateFrom = REQUIRED;
    const to = dateMode === 'single' ? dateFrom : dateTo;
    if (dateMode === 'range' && !dateTo) errors.dateTo = REQUIRED;
    if (dateFrom && to && to < dateFrom) errors.dateTo = 'Дата окончания раньше начала';
    if (scopeTab === 'CLASSES' && classIds.size === 0) {
      errors.targets = 'Выберите хотя бы один класс';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate() || !type) return;

    const to = dateMode === 'single' ? dateFrom : dateTo;
    const { scope, targets } = resolveScope(scopeTab, classIds, gradeGroups);

    try {
      if (isEdit && event) {
        await updateMutation.mutateAsync({
          id: event.id,
          body: { type, title: title.trim(), dateFrom, dateTo: to, effect, scope, targets },
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

  if (!open) return null;

  const pending = createMutation.isPending || updateMutation.isPending;
  const canSave = Boolean(title.trim() && type && dateFrom) && !pending;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="fixed inset-0 bg-navy-950/40 animate-fade-in" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 my-auto flex w-full max-w-modal-form flex-col gap-6 rounded-2xl bg-white p-8 shadow-dialog animate-scale-in"
      >
        <h2 id={titleId} className="text-xl font-bold text-ink">
          {isEdit ? 'Событие календаря' : 'Новое событие'}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <FormRow label="Название" error={fieldErrors.title}>
              <input
                ref={firstFieldRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Введите название"
                aria-invalid={Boolean(fieldErrors.title)}
                className={controlClass(Boolean(fieldErrors.title))}
              />
            </FormRow>

            <FormRow label="Тип события" error={fieldErrors.type}>
              <span className="relative block">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CalendarEventType)}
                  aria-invalid={Boolean(fieldErrors.type)}
                  className={cx(
                    controlClass(Boolean(fieldErrors.type)),
                    'appearance-none pr-10',
                    !type && 'text-subtle',
                  )}
                >
                  <option value="">Выберите тип</option>
                  {EVENT_TYPE_ORDER.map((option) => (
                    <option key={option} value={option}>
                      {CALENDAR_EVENT_TYPE_LABELS[option]}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                  aria-hidden
                />
              </span>
            </FormRow>

            <FormRow label="Даты" error={fieldErrors.dateFrom ?? fieldErrors.dateTo}>
              <div className="flex flex-col gap-2">
                <Segmented
                  ariaLabel="Тип дат"
                  options={[
                    { value: 'single', label: 'Одна дата' },
                    { value: 'range', label: 'Период' },
                  ]}
                  value={dateMode}
                  onChange={(next) => setDateMode(next as DateMode)}
                />
                <div className={cx('grid gap-2', dateMode === 'range' && 'sm:grid-cols-2')}>
                  <DateField
                    value={dateFrom}
                    invalid={Boolean(fieldErrors.dateFrom)}
                    label={dateMode === 'range' ? 'Дата начала' : 'Дата события'}
                    onChange={setDateFrom}
                  />
                  {dateMode === 'range' && (
                    <DateField
                      value={dateTo}
                      invalid={Boolean(fieldErrors.dateTo)}
                      label="Дата окончания"
                      onChange={setDateTo}
                    />
                  )}
                </div>
              </div>
            </FormRow>

            <FormRow label="Область применения" error={fieldErrors.targets}>
              <div className="flex flex-col gap-2">
                <Segmented
                  ariaLabel="Область применения"
                  options={[
                    { value: 'SCHOOL', label: 'Вся школа' },
                    { value: 'CLASSES', label: 'Классы' },
                  ]}
                  value={scopeTab}
                  onChange={(next) => setScopeTab(next as ScopeTab)}
                />
                {scopeTab === 'CLASSES' && (
                  <div className="max-h-class-list overflow-y-auto rounded-lg border border-line p-1">
                    {classesQuery.isLoading && <LoadingBlock label="Классы…" />}
                    {!classesQuery.isLoading && gradeGroups.length === 0 && (
                      <p className="p-3 text-13 text-muted">
                        В этом учебном году ещё нет классов.
                      </p>
                    )}
                    {gradeGroups.map((group) => (
                      <ParallelGroup
                        key={group.grade}
                        group={group}
                        selected={classIds}
                        onToggleClass={toggleClass}
                        onToggleGrade={toggleGrade}
                      />
                    ))}
                  </div>
                )}
              </div>
            </FormRow>

            <FormRow label="Статус">
              <Segmented
                ariaLabel="Статус занятий"
                options={[
                  { value: 'NO_LESSONS', label: 'Занятий нет' },
                  { value: 'INFO', label: 'Информационное событие' },
                ]}
                value={effect}
                onChange={(next) => setEffect(next as CalendarEventEffect)}
              />
            </FormRow>
          </div>

          {formError && <p className="text-13 text-no-lessons-fg">{formError}</p>}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-muted transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className={cx(
                'rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
                canSave ? 'bg-navy-700 hover:bg-navy-800' : 'cursor-not-allowed bg-disabled',
              )}
            >
              {pending ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Выделенные целиком параллели уезжают в scope=GRADES: так событие остаётся
 * привязанным к параллели, а не к перечню классов, и переживает добавление
 * нового класса в эту параллель.
 */
function resolveScope(
  tab: ScopeTab,
  classIds: Set<number>,
  gradeGroups: GradeClassGroup[],
): { scope: CalendarEventScope; targets: { grades?: string[]; classIds?: number[] } | null } {
  if (tab === 'SCHOOL') return { scope: 'SCHOOL', targets: null };

  const fullGrades: string[] = [];
  let coveredByGrades = 0;
  for (const group of gradeGroups) {
    const ids = group.classes.map((c) => c.id);
    if (ids.length > 0 && ids.every((id) => classIds.has(id))) {
      fullGrades.push(group.grade);
      coveredByGrades += ids.length;
    }
  }

  if (fullGrades.length > 0 && coveredByGrades === classIds.size) {
    return { scope: 'GRADES', targets: { grades: fullGrades, classIds: undefined } };
  }
  return { scope: 'CLASSES', targets: { grades: undefined, classIds: [...classIds] } };
}

function controlClass(invalid: boolean): string {
  return cx(
    'h-10 w-full rounded-lg border bg-white px-3 text-sm text-ink outline-none transition',
    'placeholder:text-subtle focus:border-navy-700',
    invalid ? 'border-no-lessons-fg' : 'border-line',
  );
}

function FormRow({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1 text-13 font-semibold text-ink">
        {label}
        <span aria-hidden className="text-no-lessons-fg">
          *
        </span>
      </span>
      {children}
      {error && <span className="text-xs text-no-lessons-fg">{error}</span>}
    </label>
  );
}

function DateField({
  value,
  label,
  invalid,
  onChange,
}: {
  value: string;
  label: string;
  invalid: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <span className="relative block">
      <span className="sr-only">{label}</span>
      {/* Нативный индикатор прячем, но не выключаем: он остаётся кликабельной
          областью поверх иконки из макета, иначе пикер открывался бы только
          с клавиатуры. */}
      <input
        type="date"
        value={value}
        aria-label={label}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          controlClass(invalid),
          'pr-10 [&::-webkit-calendar-picker-indicator]:absolute',
          '[&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:size-4',
          '[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
        )}
      />
      <Calendar
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </span>
  );
}

/** Сегментированный переключатель модалки (2015:10739). */
function Segmented({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'flex-1 rounded-md px-3 py-2 text-13 transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
              active ? 'bg-white font-semibold text-navy-700 shadow-slot' : 'font-medium text-muted',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Параллель с групповым чекбоксом и списком классов (2015:10761). */
function ParallelGroup({
  group,
  selected,
  onToggleClass,
  onToggleGrade,
}: {
  group: GradeClassGroup;
  selected: Set<number>;
  onToggleClass: (classId: number) => void;
  onToggleGrade: (ids: number[]) => void;
}) {
  const ids = group.classes.map((c) => c.id);
  const selectedCount = ids.filter((id) => selected.has(id)).length;
  const allOn = selectedCount === ids.length && ids.length > 0;

  return (
    <div className="flex flex-col gap-2 p-1">
      <label className="flex items-center gap-3 py-1">
        <TriStateCheckbox
          checked={allOn}
          indeterminate={selectedCount > 0 && !allOn}
          onChange={() => onToggleGrade(ids)}
        />
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{group.grade} параллель</span>
          <span className="text-13 text-muted">
            {ids.length} {classWord(ids.length)}
          </span>
        </span>
      </label>
      <div className="flex flex-col gap-2 pl-7">
        {group.classes.map((schoolClass) => (
          <label key={schoolClass.id} className="flex items-center gap-3">
            <TriStateCheckbox
              checked={selected.has(schoolClass.id)}
              onChange={() => onToggleClass(schoolClass.id)}
            />
            <span className="text-sm text-muted">{schoolClass.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function classWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'класс';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'класса';
  return 'классов';
}

function TriStateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="size-4 rounded border-1.5 border-subtle text-navy-700 focus-visible:ring-navy-700"
    />
  );
}
