import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronDown, Clock, Info, Plus } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { isValidTime, TimeInput } from '@/components/ui/TimeInput';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import { isVersionConflict } from '@/lib/schedule2bApi';
import type {
  PreferredShift,
  TeacherAvailability,
  TeacherAvailabilitySummary,
} from '@/lib/schedule2bTypes';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import {
  useSaveTeacherAvailability,
  useTeacherAvailability,
} from '@/platform/hooks/useTeacherAvailability';
import { WEEKDAY_LABELS, WEEKDAY_SHORT_LABELS, WEEKDAYS_ORDER } from '@/platform/labels';
import { AvailabilityTimelineGrid } from './AvailabilityTimelineGrid';
import {
  expandGridPeriods,
  setWorkingHours,
  toggleSlot,
  workingHoursDiffer,
  workingHoursLabel,
  workingHoursRange,
  type GridPeriod,
} from './availabilityGrid';
import {
  availabilityToDraft,
  emptyAvailabilityDraft,
  draftToPutBody,
  nextIntervalKey,
  rowErrorMessage,
  sameDraft,
  sortDays,
  validateAvailabilityDraft,
  type AvailabilityDraft,
} from './availabilityValidation';
import { teacherFullName } from './TeacherPickerColumn';

const SHIFT_LABELS: Record<PreferredShift, string> = {
  FIRST: '1 смена',
  SECOND: '2 смена',
};

/**
 * Общая обёртка правой колонки (2015:10964).
 *
 * min-w-0 обязателен: без него минимальная ширина сетки распирает
 * flex-строку и на узких экранах карточка уезжает за край вместо того,
 * чтобы отдать прокрутку самой сетке.
 */
function PanelCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-5 rounded-2xl border border-line bg-white p-6">
      {children}
    </div>
  );
}

/** «Занятость не выбрана» (2015:11162) и «список пуст» (2015:11195). */
export function EmptyPanel({ variant }: { variant: 'no-selection' | 'no-teachers' }) {
  if (variant === 'no-teachers') {
    return (
      <PanelCard>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <span className="flex size-11 items-center justify-center rounded-full bg-info-bg">
            <Info className="size-6 text-navy-700" aria-hidden />
          </span>
          <p className="max-w-state-text text-center text-15 font-medium text-subtle">
            Выберите учителя из списка слева, чтобы посмотреть и настроить рабочее время.
          </p>
        </div>
      </PanelCard>
    );
  }

  return (
    <PanelCard>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-2xl border border-line p-12">
        <Calendar className="size-16 text-subtle" strokeWidth={1} aria-hidden />
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-base font-semibold text-ink">Занятость не выбрана</p>
          <p className="max-w-state-text-wide text-sm text-muted">
            Выберите учителя слева, чтобы посмотреть или изменить занятость
          </p>
        </div>
      </div>
    </PanelCard>
  );
}

/**
 * Правая колонка «Занятость учителей»: просмотр (Figma 2015:10964),
 * пустая занятость (2015:11303) и режим правки (2015:11449).
 *
 * Черновик и валидация — общие с формой интервалов: слоты сетки и форма
 * добавления пишут в один AvailabilityDraft.
 */
export function TeacherAvailabilityPanel({
  teacher,
  periods,
  templateHint,
  onDirtyChange,
}: {
  teacher: TeacherAvailabilitySummary;
  periods: GridPeriod[];
  /** Почему сетки нет: шаблон не выбран или в нём нет уроков. */
  templateHint: string | null;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const toast = useToast();
  const teacherId = teacher.teacherId;
  const query = useTeacherAvailability(teacherId);
  const saveMutation = useSaveTeacherAvailability(teacherId);

  const [draft, setDraft] = useState<AvailabilityDraft | null>(null);
  const [baseline, setBaseline] = useState<AvailabilityDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [chipError, setChipError] = useState<string | null>(null);
  const [versionConflictOpen, setVersionConflictOpen] = useState(false);

  const availability = query.data;

  useEffect(() => {
    setDraft(null);
    setBaseline(null);
    setEditing(false);
    setChipError(null);
    setVersionConflictOpen(false);
  }, [teacherId]);

  // Сервер — источник правды, пока пользователь не начал править.
  useEffect(() => {
    if (!availability || availability.teacherId !== teacherId || editing) return;
    const next = availability.exists ? availabilityToDraft(availability) : null;
    setDraft(next);
    setBaseline(next);
  }, [availability, teacherId, editing]);

  const dirty = useMemo(
    () => (draft && baseline ? !sameDraft(draft, baseline) : Boolean(draft) !== Boolean(baseline)),
    [draft, baseline],
  );

  useEffect(() => {
    onDirtyChange?.(editing && dirty);
  }, [editing, dirty, onDirtyChange]);

  const validation = useMemo(
    () =>
      draft
        ? validateAvailabilityDraft(draft)
        : { byKey: {}, dayChipErrors: {}, hasErrors: false },
    [draft],
  );
  const intervalError = useMemo(() => {
    for (const error of Object.values(validation.byKey)) {
      const message = rowErrorMessage(error);
      if (message) return message;
    }
    return null;
  }, [validation]);

  // Хуки до любых early return — иначе при смене loading→data меняется их порядок.
  const gridPeriods = useMemo(() => expandGridPeriods(periods, draft), [periods, draft]);

  function startEditing(seed: AvailabilityDraft | null) {
    setDraft(seed ?? emptyAvailabilityDraft());
    setEditing(true);
    setChipError(null);
  }

  function cancelEditing() {
    setDraft(baseline);
    setEditing(false);
    setChipError(null);
  }

  function reloadFromServer() {
    setVersionConflictOpen(false);
    setEditing(false);
    setDraft(null);
    setBaseline(null);
    void query.refetch();
  }

  function setWorkingDays(proposed: Weekday[]) {
    if (!draft) return;
    const check = validateAvailabilityDraft(draft, { proposedWorkingDays: proposed });
    const blocked = Object.values(check.dayChipErrors)[0];
    if (blocked) {
      setChipError(blocked);
      return;
    }
    setChipError(null);
    setDraft({ ...draft, workingDays: sortDays(proposed) });
  }

  async function onSave() {
    if (!draft) return;
    if (validateAvailabilityDraft(draft).hasErrors) {
      toast.error('Исправьте ошибки в интервалах перед сохранением');
      return;
    }
    try {
      const saved = await saveMutation.mutateAsync(draftToPutBody(draft));
      const next = availabilityToDraft(saved);
      setDraft(next);
      setBaseline(next);
      setEditing(false);
      setChipError(null);
      toast.success('График утверждён');
    } catch (err) {
      if (isVersionConflict(err)) {
        setVersionConflictOpen(true);
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить график');
    }
  }

  if (query.isLoading) {
    return (
      <PanelCard>
        <LoadingBlock label="Загрузка графика…" />
      </PanelCard>
    );
  }

  if (query.isError) {
    return (
      <PanelCard>
        <ErrorBlock
          message={
            query.error instanceof Error ? query.error.message : 'Не удалось загрузить график'
          }
          onRetry={() => void query.refetch()}
        />
      </PanelCard>
    );
  }

  const shownDraft = draft;
  const hours = shownDraft ? workingHoursLabel(shownDraft) : null;
  const gridDays = shownDraft ? shownDraft.workingDays : [];
  const canSave = Boolean(shownDraft) && dirty && !validation.hasErrors;

  return (
    <PanelCard>
      <PanelHeader
        teacher={teacher}
        editing={editing}
        canEdit={Boolean(availability)}
        onEdit={() => startEditing(baseline)}
      />

      <div className="flex flex-col gap-3">
        <WorkingDayChips
          value={gridDays}
          editable={editing}
          disabled={saveMutation.isPending}
          onChange={setWorkingDays}
        />
        {chipError && <p className="text-11 text-red-500">{chipError}</p>}

        <div className="flex flex-wrap items-center gap-3">
          {editing && shownDraft ? (
            <WorkingHoursControl
              draft={shownDraft}
              disabled={saveMutation.isPending}
              onChange={setDraft}
            />
          ) : (
            <p className="flex items-center gap-1.5 text-13 text-muted">
              <Clock className="size-3.5 shrink-0 text-subtle" aria-hidden />
              {hours ? `Рабочие часы: ${hours}` : 'Рабочие часы не настроены'}
            </p>
          )}
          <PreferredShiftControl
            value={shownDraft?.preferredShift ?? null}
            editable={editing}
            disabled={saveMutation.isPending}
            onChange={(preferredShift) =>
              shownDraft && setDraft({ ...shownDraft, preferredShift })
            }
          />
        </div>
      </div>

      {!shownDraft ? (
        <EmptyAvailability
          disabled={saveMutation.isPending}
          onFill={() => startEditing(emptyAvailabilityDraft())}
        />
      ) : templateHint ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-line bg-gray-50 p-12 text-center">
          <Calendar className="size-8 text-subtle" aria-hidden />
          <p className="max-w-state-text text-13 text-muted">{templateHint}</p>
        </div>
      ) : gridDays.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-line bg-gray-50 p-12 text-center">
          <Calendar className="size-8 text-subtle" aria-hidden />
          <p className="max-w-state-text text-13 text-muted">
            Не выбран ни один рабочий день — отметьте дни выше, чтобы задать занятость.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <AvailabilityTimelineGrid
            periods={gridPeriods}
            days={gridDays}
            draft={shownDraft}
            editable={editing}
            disabled={saveMutation.isPending}
            onToggle={(day, period) => setDraft(toggleSlot(shownDraft, day, period))}
          />
          {intervalError && <p className="text-11 text-red-500">{intervalError}</p>}
        </div>
      )}

      {editing && shownDraft && (
        <AddIntervalForm
          workingDays={shownDraft.workingDays}
          disabled={saveMutation.isPending}
          onAdd={(row) =>
            setDraft({ ...shownDraft, intervals: [...shownDraft.intervals, row] })
          }
        />
      )}

      {editing ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={cancelEditing}
            className="rounded-lg border-1.5 border-brand-500 px-5 py-2.5 text-sm font-semibold text-brand-500 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
          >
            Отменить
          </button>
          <button
            type="button"
            disabled={!canSave || saveMutation.isPending}
            onClick={() => void onSave()}
            className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:bg-disabled"
          >
            {saveMutation.isPending ? 'Сохранение…' : 'Утвердить'}
          </button>
        </div>
      ) : (
        <StatusFooter availability={availability} />
      )}

      <ConfirmDialog
        open={versionConflictOpen}
        onClose={() => setVersionConflictOpen(false)}
        onConfirm={reloadFromServer}
        title="График изменён"
        message="График доступности изменил другой администратор. Загрузите актуальную версию — перезаписать молча нельзя."
        confirmLabel="Загрузить актуальный"
        cancelLabel="Остаться"
      />
    </PanelCard>
  );
}

function PanelHeader({
  teacher,
  editing,
  canEdit,
  onEdit,
}: {
  teacher: TeacherAvailabilitySummary;
  editing: boolean;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-ink">{teacherFullName(teacher)}</h2>
          {teacher.subjects.map((subject) => (
            <span key={subject} className="rounded bg-gray-100 px-2 py-0.5 text-11 text-muted">
              {subject}
            </span>
          ))}
        </div>
        <Link
          to={`/teachers/${teacher.accountId}`}
          className="w-fit text-13 font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"
        >
          Открыть карточку учителя →
        </Link>
      </div>

      {editing ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-link bg-info-bg px-4 py-2 text-13 font-semibold text-link">
          <span aria-hidden className="size-2 rounded-full bg-link" />
          Режим редактирования
        </p>
      ) : (
        <button
          type="button"
          disabled={!canEdit}
          onClick={onEdit}
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-13 font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:bg-disabled"
        >
          Редактировать
        </button>
      )}
    </div>
  );
}

/** DayChip 48×40 (2015:10978). В просмотре — статичные метки, в правке — тумблеры. */
function WorkingDayChips({
  value,
  editable,
  disabled,
  onChange,
}: {
  value: Weekday[];
  editable: boolean;
  disabled: boolean;
  onChange: (next: Weekday[]) => void;
}) {
  const selected = new Set(value);

  function toggle(day: Weekday) {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange(WEEKDAYS_ORDER.filter((d) => next.has(d)));
  }

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Рабочие дни учителя">
      {WEEKDAYS_ORDER.map((day) => {
        const on = selected.has(day);
        const look = cx(
          'flex h-10 w-12 items-center justify-center rounded-lg text-sm font-bold transition',
          on ? 'bg-navy-700 text-white' : 'border border-line bg-white text-muted',
        );
        return (
          <li key={day}>
            {editable ? (
              <button
                type="button"
                disabled={disabled}
                aria-pressed={on}
                onClick={() => toggle(day)}
                className={cx(
                  look,
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  !on && 'hover:bg-gray-50',
                )}
              >
                <span className="sr-only">{WEEKDAY_LABELS[day]}</span>
                <span aria-hidden>{WEEKDAY_SHORT_LABELS[day]}</span>
              </button>
            ) : (
              <span className={look} title={WEEKDAY_LABELS[day]}>
                <span className="sr-only">
                  {WEEKDAY_LABELS[day]} — {on ? 'рабочий день' : 'выходной'}
                </span>
                <span aria-hidden>{WEEKDAY_SHORT_LABELS[day]}</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Рабочие часы. В макете (2015:11478) это статическая строка даже в режиме
 * правки, но сузить окно иначе нельзя: сетка правит только слоты уроков, а
 * окно доступности обычно шире последнего урока.
 *
 * Локальное состояние нужно, чтобы не терять недонабранное «08:» — в черновик
 * уходит только полный валидный диапазон.
 */
function WorkingHoursControl({
  draft,
  disabled,
  onChange,
}: {
  draft: AvailabilityDraft;
  disabled: boolean;
  onChange: (next: AvailabilityDraft) => void;
}) {
  const range = workingHoursRange(draft);
  const rangeKey = range ? `${range[0]}-${range[1]}` : '';
  const [value, setValue] = useState({ start: range?.[0] ?? '', end: range?.[1] ?? '' });
  const syncedKey = useRef(rangeKey);

  // Окно могло измениться и мимо этих полей — например кликом по ячейке.
  useEffect(() => {
    if (rangeKey === syncedKey.current) return;
    syncedKey.current = rangeKey;
    setValue({ start: range?.[0] ?? '', end: range?.[1] ?? '' });
  }, [rangeKey, range]);

  function commit(next: { start: string; end: string }) {
    setValue(next);
    const updated = setWorkingHours(draft, next.start, next.end);
    if (updated !== draft) {
      syncedKey.current = `${next.start}-${next.end}`;
      onChange(updated);
    }
  }

  const bothFilled = isValidTime(value.start) && isValidTime(value.end);
  const invertedRange = bothFilled && setWorkingHours(draft, value.start, value.end) === draft;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-13 text-muted">
          <Clock className="size-3.5 shrink-0 text-subtle" aria-hidden />
          Рабочие часы
        </span>
        <label className="flex items-center gap-1.5 text-13 text-muted">
          <span className="sr-only">Начало рабочих часов</span>
          <TimeInput
            value={value.start}
            disabled={disabled}
            error={invertedRange}
            onChange={(start) => commit({ ...value, start })}
            className={cx(CONTROL_CLASS, 'w-24')}
          />
        </label>
        <span aria-hidden className="text-13 text-muted">
          –
        </span>
        <label className="flex items-center gap-1.5 text-13 text-muted">
          <span className="sr-only">Окончание рабочих часов</span>
          <TimeInput
            value={value.end}
            disabled={disabled}
            error={invertedRange}
            onChange={(end) => commit({ ...value, end })}
            className={cx(CONTROL_CLASS, 'w-24')}
          />
        </label>
      </div>
      {invertedRange && (
        <p className="text-11 text-red-500">Окончание должно быть позже начала</p>
      )}
      {!invertedRange && workingHoursDiffer(draft) && (
        <p className="text-11 text-subtle">
          Сейчас окна по дням различаются — новое время применится ко всем рабочим дням.
        </p>
      )}
    </div>
  );
}

/**
 * «Предпочтительная смена». В макетах поля нет, но оно есть в PUT — без него
 * значение стало бы недоступным для правки из админки.
 */
function PreferredShiftControl({
  value,
  editable,
  disabled,
  onChange,
}: {
  value: PreferredShift | null;
  editable: boolean;
  disabled: boolean;
  onChange: (next: PreferredShift | null) => void;
}) {
  if (!editable) {
    if (!value) return null;
    return (
      <span className="rounded bg-gray-100 px-2 py-0.5 text-11 text-muted">
        {SHIFT_LABELS[value]}
      </span>
    );
  }

  return (
    <label className="flex items-center gap-2 text-13 text-muted">
      Предпочтительная смена
      <span className="relative">
        <select
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === 'FIRST' || raw === 'SECOND' ? raw : null);
          }}
          className="appearance-none rounded-lg border border-line bg-white py-1.5 pl-3 pr-8 text-13 font-medium text-ink outline-none transition focus:border-navy-700 disabled:bg-gray-50"
        >
          <option value="">Не важно</option>
          <option value="FIRST">{SHIFT_LABELS.FIRST}</option>
          <option value="SECOND">{SHIFT_LABELS.SECOND}</option>
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-subtle"
          aria-hidden
        />
      </span>
    </label>
  );
}

/** «Данные о занятости пока не заполнены» (2015:11332). */
function EmptyAvailability({ disabled, onFill }: { disabled: boolean; onFill: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-line bg-gray-50 p-12">
      <span className="rounded-full bg-gray-100 p-4">
        <Calendar className="size-8 text-subtle" aria-hidden />
      </span>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-base font-bold text-ink">Данные о занятости пока не заполнены</p>
        <p className="max-w-state-text text-13 text-muted">
          Задайте рабочие дни, часы и индивидуальные интервалы для составления точного школьного
          расписания.
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onFill}
        className="rounded-lg bg-brand-500 px-5 py-2.5 text-13 font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:bg-disabled"
      >
        Заполнить занятость
      </button>
    </div>
  );
}

/** Форма «Добавить интервал занятости» (2015:11523). */
function AddIntervalForm({
  workingDays,
  disabled,
  onAdd,
}: {
  workingDays: Weekday[];
  disabled: boolean;
  onAdd: (row: {
    key: string;
    dayOfWeek: Weekday;
    startTime: string;
    endTime: string;
    type: 'AVAILABLE' | 'UNAVAILABLE';
  }) => void;
}) {
  const fallbackDay = workingDays[0] ?? 'MONDAY';
  const [day, setDay] = useState<Weekday>(fallbackDay);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [type, setType] = useState<'AVAILABLE' | 'UNAVAILABLE'>('AVAILABLE');
  const dayRef = useRef<HTMLSelectElement>(null);

  // Рабочие дни правятся чипами; выбранный день не должен «зависать» вне них.
  useEffect(() => {
    if (!workingDays.includes(day)) setDay(fallbackDay);
  }, [workingDays, day, fallbackDay]);

  function submit() {
    onAdd({ key: nextIntervalKey(), dayOfWeek: day, startTime, endTime, type });
    dayRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-gray-100 p-4">
      <p className="text-13 font-bold text-ink">Добавить интервал занятости</p>
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="День" className="min-w-28 flex-1">
          <SelectControl
            ref={dayRef}
            value={day}
            disabled={disabled}
            onChange={(next) => setDay(next as Weekday)}
          >
            {WEEKDAYS_ORDER.map((option) => (
              <option key={option} value={option} disabled={!workingDays.includes(option)}>
                {WEEKDAY_SHORT_LABELS[option]}
              </option>
            ))}
          </SelectControl>
        </FormField>

        <FormField label="Время от" className="min-w-28 flex-1">
          <TimeControl value={startTime} disabled={disabled} onChange={setStartTime} />
        </FormField>

        <FormField label="Время до" className="min-w-28 flex-1">
          <TimeControl value={endTime} disabled={disabled} onChange={setEndTime} />
        </FormField>

        <FormField label="Тип" className="min-w-28 flex-1">
          <SelectControl
            value={type}
            disabled={disabled}
            onChange={(next) => setType(next as 'AVAILABLE' | 'UNAVAILABLE')}
          >
            <option value="AVAILABLE">Свободна</option>
            <option value="UNAVAILABLE">Недоступна</option>
          </SelectControl>
        </FormField>

        <button
          type="button"
          disabled={disabled}
          onClick={submit}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-navy-700 px-4 text-13 font-semibold text-white transition hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 disabled:bg-disabled"
        >
          <Plus className="size-3.5" aria-hidden />
          Добавить
        </button>
      </div>
    </div>
  );
}

function FormField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cx('flex flex-col gap-1', className)}>
      <span className="text-11 font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

const CONTROL_CLASS =
  'h-9 w-full rounded-lg border border-line bg-white px-3 text-13 font-medium text-ink outline-none transition focus:border-navy-700 disabled:bg-gray-50';

const SelectControl = forwardRef<
  HTMLSelectElement,
  {
    value: string;
    disabled: boolean;
    onChange: (next: string) => void;
    children: React.ReactNode;
  }
>(function SelectControl({ value, disabled, onChange, children }, ref) {
  return (
    <span className="relative block">
      <select
        ref={ref}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cx(CONTROL_CLASS, 'appearance-none pr-9')}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-subtle"
        aria-hidden
      />
    </span>
  );
});

function TimeControl({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <span className="relative block">
      <TimeInput
        value={value}
        disabled={disabled}
        onChange={onChange}
        className={cx(CONTROL_CLASS, 'pr-9')}
      />
      <Clock
        className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-subtle"
        aria-hidden
      />
    </span>
  );
}

function StatusFooter({ availability }: { availability: TeacherAvailability | undefined }) {
  const approved = availability?.exists === true && availability.status === 'APPROVED';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-13 text-muted">Текущий статус занятости:</p>
      <span
        className={cx(
          'rounded-md px-2.5 py-1 text-13 font-semibold',
          approved ? 'bg-success-bg text-success-fg' : 'bg-attention-bg text-attention-fg',
        )}
      >
        {approved ? 'Утверждено' : 'Проверить'}
      </span>
    </div>
  );
}
