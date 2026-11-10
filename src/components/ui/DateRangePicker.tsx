import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '@/lib/format';
import { Button } from './Button';

export interface DateRangeValue {
  from: string;
  to: string;
}

export interface OccupiedDateRange {
  from: string;
  to: string;
}

/** Calendar picker for LocalDate strings; parsing and grid arithmetic stay in UTC. */
export function DateRangePicker({
  value,
  onChange,
  occupiedRanges = [],
  disabled = false,
  error = false,
  placeholder = 'Выберите день или период',
}: {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  occupiedRanges?: OccupiedDateRange[];
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectionStart, setSelectionStart] = useState<string | null>(null);
  const [month, setMonth] = useState(() => startOfMonth(parseDate(value.from) ?? parseDate(todayKey()) ?? new Date()));
  const root = useRef<HTMLDivElement>(null);
  const today = todayKey();
  const days = useMemo(() => calendarDays(month), [month]);
  const hasRange = Boolean(value.from && value.to);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  function selectDate(date: string) {
    if (date < today || isOccupied(date, occupiedRanges)) return;
    if (!selectionStart || date < selectionStart) {
      setSelectionStart(date);
      onChange({ from: date, to: date });
      return;
    }
    onChange({ from: selectionStart, to: date });
    setSelectionStart(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') setOpen(false);
  }

  const displayValue = value.from
    ? hasRange ? value.from === value.to ? formatDateOnly(value.from) : `${formatDateOnly(value.from)} — ${formatDateOnly(value.to)}` : formatDateOnly(value.from)
    : placeholder;

  return (
    <div ref={root} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            setMonth(startOfMonth(parseDate(value.from) ?? parseDate(today) ?? new Date()));
            setSelectionStart(null);
          }
          setOpen((current) => !current);
        }}
        className={cx(
          'input-base flex w-full items-center justify-between gap-3 text-left',
          error && 'border-red-300 focus:border-red-400 focus:ring-red-300/30',
          !value.from && 'text-subtle',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
        )}
      >
        <span className="truncate">{displayValue}</span>
        <CalendarDays className="size-4 shrink-0 text-subtle" aria-hidden />
      </button>
      {open && <div role="dialog" aria-label="Выбор дат отсутствия" className="absolute left-0 top-full z-40 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-line bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" aria-label="Предыдущий месяц" onClick={() => setMonth((current) => addMonths(current, -1))} className="rounded-lg p-2 text-muted hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"><ChevronLeft className="size-4" aria-hidden /></button>
          <p className="text-sm font-semibold capitalize text-ink">{new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(month)}</p>
          <button type="button" aria-label="Следующий месяц" onClick={() => setMonth((current) => addMonths(current, 1))} className="rounded-lg p-2 text-muted hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"><ChevronRight className="size-4" aria-hidden /></button>
        </div>
        <div role="grid" aria-label="Дни месяца" className="grid grid-cols-7 gap-1 text-center">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((weekday) => <span key={weekday} className="pb-1 text-xs font-medium text-subtle">{weekday}</span>)}
          {days.map((date) => {
            const key = dateKey(date);
            const outsideMonth = date.getUTCMonth() !== month.getUTCMonth();
            if (outsideMonth) return <span key={key} aria-hidden className="size-9" />;
            const past = key < today;
            const unavailable = isOccupied(key, occupiedRanges);
            const selected = key === value.from || key === value.to;
            const insideRange = hasRange && key > value.from && key < value.to;
            return <button
              key={key}
              type="button"
              aria-label={`${formatDateOnly(key)}${past ? ', прошедшая дата' : ''}${unavailable ? ', дата уже занята' : ''}`}
              aria-pressed={selected}
              aria-disabled={past || unavailable}
              disabled={past || unavailable}
              title={past ? 'Прошедшую дату выбрать нельзя' : unavailable ? 'Дата пересекается с другой заявкой' : undefined}
              onClick={() => selectDate(key)}
              className={cx(
                'relative mx-auto flex size-9 items-center justify-center rounded-full text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
                !outsideMonth && !selected && !insideRange && !past && !unavailable && 'text-ink hover:bg-slate-100',
                insideRange && 'rounded-none bg-indigo-50 text-navy-700',
                selected && 'rounded-xl bg-navy-700 font-semibold text-white hover:bg-navy-800',
                (past || unavailable) && !selected && 'cursor-not-allowed text-slate-400',
                unavailable && 'rounded-xl bg-slate-100 line-through',
                past && !unavailable && !selected && 'text-slate-300',
              )}
            >
              {date.getUTCDate()}
              {!outsideMonth && !unavailable && key === today && <span aria-hidden className="absolute bottom-0.5 size-1.5 rounded-full bg-brand-500" />}
              {!outsideMonth && unavailable && <span aria-hidden className="absolute bottom-0.5 size-1.5 rounded-full bg-slate-400" />}
            </button>;
          })}
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-navy-700" />Выбранный период</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand-500" />Сегодня</span>
            {occupiedRanges.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-slate-300" />Занято другой заявкой</span>}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink">{hasRange ? summaryValue(value.from, value.to) : 'Выберите день или начальную дату периода'}</span>
            <Button size="sm" disabled={!value.from} onClick={() => { if (value.from && !value.to) onChange({ from: value.from, to: value.from }); setSelectionStart(null); setOpen(false); }}>Готово</Button>
          </div>
        </div>
      </div>}
    </div>
  );
}

export function rangesOverlap(from: string, to: string, ranges: OccupiedDateRange[]) {
  if (!from || !to) return false;
  return ranges.some((range) => from <= range.to && to >= range.from);
}

function isOccupied(date: string, ranges: OccupiedDateRange[]) {
  return ranges.some((range) => date >= range.from && date <= range.to);
}
function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function startOfMonth(value: Date) { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1)); }
function addMonths(value: Date, months: number) { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1)); }
function dateKey(value: Date) { return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`; }
function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function calendarDays(month: Date) {
  const first = startOfMonth(month);
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1 - mondayOffset));
  return Array.from({ length: 42 }, (_, index) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + index)));
}
function formatDateOnly(value: string) {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
    : '';
}
function summaryValue(from: string, to: string) {
  const days = Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  const dayWord = days % 10 === 1 && days % 100 !== 11 ? 'день' : days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 12 || days % 100 > 14) ? 'дня' : 'дней';
  return `${from === to ? formatDateOnly(from) : `${formatDateOnly(from)} — ${formatDateOnly(to)}`} · ${days} ${dayWord}`;
}
