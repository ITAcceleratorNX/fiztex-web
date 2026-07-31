import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '@/lib/format';
import type { CalendarEvent } from '@/lib/scheduleSettingsTypes';
import { CALENDAR_EVENT_TYPE_LABELS, WEEKDAY_SHORT_LABELS, WEEKDAYS_ORDER } from '@/platform/labels';
import { EVENT_TYPE_BADGE } from './calendarBadges';
import { buildMonthGrid, monthTitle, shiftMonth, type YearMonth } from './calendarMonth';

/**
 * Месячное представление событий (Figma 2015:10147).
 *
 * Дни соседних месяцев показываются приглушённо, но кликабельны так же —
 * событие, попавшее на них, остаётся доступным для правки.
 */
export function EventsMonthGrid({
  month,
  events,
  onMonthChange,
  onEventClick,
}: {
  month: YearMonth;
  events: CalendarEvent[];
  onMonthChange: (next: YearMonth) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const weeks = buildMonthGrid(month, events);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <h3 className="text-lg font-bold text-ink">{monthTitle(month)}</h3>
        <div className="flex items-center gap-1">
          <MonthNavButton
            label="Предыдущий месяц"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
          >
            <ChevronLeft className="size-3.5" aria-hidden />
          </MonthNavButton>
          <MonthNavButton label="Следующий месяц" onClick={() => onMonthChange(shiftMonth(month, 1))}>
            <ChevronRight className="size-3.5" aria-hidden />
          </MonthNavButton>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-slot-grid table-fixed border-collapse">
          <caption className="sr-only">
            События школьного календаря за {monthTitle(month)}
          </caption>
          <thead>
            <tr className="h-10">
              {WEEKDAYS_ORDER.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="border-b border-line text-13 font-medium text-muted"
                >
                  {WEEKDAY_SHORT_LABELS[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]!.date}>
                {week.map((cell, index) => (
                  <td
                    key={cell.date}
                    className={cx(
                      'h-slot-row-lg border-b border-line p-2 align-top',
                      index > 0 && 'border-l',
                    )}
                  >
                    <div className="flex h-full flex-col gap-1 overflow-hidden">
                      <span
                        className={cx('text-13', cell.outside ? 'text-subtle' : 'text-ink')}
                      >
                        {cell.dayOfMonth}
                      </span>
                      {cell.events.map((event) => (
                        <button
                          key={`${cell.date}-${event.id}`}
                          type="button"
                          onClick={() => onEventClick(event)}
                          title={`${event.title} · ${CALENDAR_EVENT_TYPE_LABELS[event.type]}`}
                          className={cx(
                            'w-full truncate rounded px-1.5 py-0.5 text-left text-10 font-semibold transition',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
                            'hover:brightness-95',
                            EVENT_TYPE_BADGE[event.type],
                          )}
                        >
                          {event.title}
                        </button>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MonthNavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cx(
        'inline-flex size-6 items-center justify-center rounded-md border border-line text-muted transition',
        'hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
      )}
    >
      {children}
    </button>
  );
}
