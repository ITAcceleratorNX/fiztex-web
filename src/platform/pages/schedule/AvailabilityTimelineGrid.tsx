import { cx } from '@/lib/format';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import { WEEKDAY_LABELS } from '@/platform/labels';
import { slotState, type GridPeriod } from './availabilityGrid';
import type { AvailabilityDraft } from './availabilityValidation';

/**
 * Сетка «урок × рабочий день» (Figma 2015:10995 — просмотр, 2015:11482 — правка).
 *
 * Таблица, а не div-сетка: данные табличные, скринридеру нужны заголовки
 * строк и столбцов. В режиме правки ячейка — кнопка: клик переключает
 * «Свободно» ⇄ «Недоступно».
 */
export function AvailabilityTimelineGrid({
  periods,
  days,
  draft,
  editable = false,
  disabled = false,
  onToggle,
}: {
  periods: GridPeriod[];
  /** Колонки — рабочие дни учителя, в порядке недели. */
  days: Weekday[];
  draft: AvailabilityDraft;
  editable?: boolean;
  disabled?: boolean;
  onToggle?: (day: Weekday, period: GridPeriod) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-gray-50">
      <table className="w-full min-w-slot-grid table-fixed border-collapse">
        <caption className="sr-only">
          Занятость учителя по урокам и дням недели
        </caption>
        <colgroup>
          <col className="w-slot-time-col" />
          {days.map((day) => (
            <col key={day} />
          ))}
        </colgroup>
        <thead>
          <tr className="h-9 bg-gray-100">
            <th scope="col" className="border-b border-line text-11 font-semibold text-subtle">
              ВРЕМЯ
            </th>
            {days.map((day) => (
              <th
                key={day}
                scope="col"
                className="border-b border-l border-line text-13 font-semibold text-navy-700"
              >
                {WEEKDAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period.lessonNumber} className={editable ? 'h-slot-row-edit' : 'h-slot-row'}>
              <th scope="row" className="border-b border-line px-3 font-normal">
                <span className="block text-xs font-bold text-ink">{period.lessonNumber}</span>
                <span className="block text-10 text-subtle">
                  {period.startTime}–{period.endTime}
                </span>
              </th>
              {days.map((day) => (
                <td key={day} className="border-b border-l border-line p-1">
                  <SlotCell
                    state={slotState(draft, day, period)}
                    editable={editable}
                    disabled={disabled}
                    day={day}
                    period={period}
                    onToggle={onToggle}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SLOT_LABEL = { FREE: 'Свободно', BLOCKED: 'Недоступно' } as const;

function SlotCell({
  state,
  editable,
  disabled,
  day,
  period,
  onToggle,
}: {
  state: 'FREE' | 'BLOCKED';
  editable: boolean;
  disabled: boolean;
  day: Weekday;
  period: GridPeriod;
  onToggle?: (day: Weekday, period: GridPeriod) => void;
}) {
  const free = state === 'FREE';
  const label = SLOT_LABEL[state];

  if (!editable) {
    return (
      <span
        className={cx(
          'flex h-full w-full items-center justify-center rounded-md px-2 py-2 text-11 font-bold',
          free ? 'bg-success-bg text-success-fg' : 'bg-gray-100 text-muted',
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={free}
      // Заголовки строки и столбца скринридер и так объявляет — здесь только действие.
      aria-label={`${label}: ${WEEKDAY_LABELS[day]}, урок ${period.lessonNumber}`}
      onClick={() => onToggle?.(day, period)}
      className={cx(
        'flex h-full w-full flex-col items-center justify-between rounded-md p-1 transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
        'disabled:cursor-not-allowed disabled:opacity-60',
        free
          ? 'border-1.5 border-success-border bg-success-bg text-success-fg'
          : 'border border-subtle bg-gray-100 text-muted',
      )}
    >
      <SlotHandle free={free} />
      <span className="text-11 font-bold">{label}</span>
      <SlotHandle free={free} />
    </button>
  );
}

/** Полоски-«ручки» из макета (2015:12019). Декор: правка идёт кликом. */
function SlotHandle({ free }: { free: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        'h-1 w-6 shrink-0 rounded-sm opacity-40',
        free ? 'bg-success-border' : 'bg-subtle',
      )}
    />
  );
}
