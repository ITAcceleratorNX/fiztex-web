import { forwardRef, useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock, Plus } from 'lucide-react';
import { isValidTime, TimeInput } from '@/components/ui/TimeInput';
import { cx } from '@/lib/format';
import type { PreferredShift } from '@/lib/schedule2bTypes';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import { WEEKDAY_LABELS, WEEKDAY_SHORT_LABELS, WEEKDAYS_ORDER } from '@/platform/labels';
import { setWorkingHours, workingHoursDiffer, workingHoursRange } from './availabilityGrid';
import { nextIntervalKey, type AvailabilityDraft } from './availabilityValidation';

/**
 * Контролы занятости, общие для двух экранов: админской карточки «Занятость
 * учителей» и учительского «Моё рабочее время».
 *
 * Вынесены сюда не ради красоты — правила у обеих сторон обязаны совпадать.
 * Учитель просит те же часы, которые админ потом утверждает, и разъехавшиеся
 * формы означали бы, что заявка описывает не то, что видит утверждающий.
 */

export const SHIFT_LABELS: Record<PreferredShift, string> = {
  FIRST: '1 смена',
  SECOND: '2 смена',
};

/** DayChip 48×40 (2015:10978). В просмотре — статичные метки, в правке — тумблеры. */
export function WorkingDayChips({
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
export function WorkingHoursControl({
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
export function PreferredShiftControl({
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

/** Форма «Добавить интервал занятости» (2015:11523). */
export function AddIntervalForm({
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

export function FormField({
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

export const CONTROL_CLASS =
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


/**
 * Список интервалов с удалением.
 *
 * Нужен там, где нет сетки шаблона звонков: в админской карточке интервал
 * снимают кликом по ячейке урока, а учитель своих уроков ещё не знает — и без
 * списка не увидел бы, что вообще отправляет.
 */
export function IntervalListEditor({
  intervals,
  errorOf,
  disabled,
  onRemove,
}: {
  intervals: AvailabilityDraft['intervals'];
  errorOf: (key: string) => string | null;
  disabled: boolean;
  onRemove: (key: string) => void;
}) {
  if (intervals.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line p-4 text-13 text-muted">
        Интервалов нет — в рабочие дни вы свободны целиком. Добавьте интервал, чтобы сузить
        часы или закрыть время внутри дня.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {intervals.map((row) => {
        const error = errorOf(row.key);
        return (
          <li
            key={row.key}
            className={cx(
              'flex flex-wrap items-center gap-2 rounded-lg border p-2.5',
              error ? 'border-red-300 bg-red-50' : 'border-line bg-white',
            )}
          >
            <span className="w-8 shrink-0 text-13 font-semibold text-ink">
              {WEEKDAY_SHORT_LABELS[row.dayOfWeek]}
            </span>
            <span className="text-13 tabular-nums text-ink">
              {row.startTime} – {row.endTime}
            </span>
            <span
              className={cx(
                'rounded px-2 py-0.5 text-10 font-semibold',
                row.type === 'AVAILABLE'
                  ? 'bg-success-bg text-success-fg'
                  : 'bg-red-100 text-red-600',
              )}
            >
              {row.type === 'AVAILABLE' ? 'Свободна' : 'Недоступна'}
            </span>
            {error && <span className="text-11 text-red-500">{error}</span>}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRemove(row.key)}
              className="ml-auto rounded-lg border border-line px-2.5 py-1 text-11 font-semibold text-muted transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 disabled:opacity-60"
            >
              Удалить
            </button>
          </li>
        );
      })}
    </ul>
  );
}
