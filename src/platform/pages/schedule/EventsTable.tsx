import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { cx } from '@/lib/format';
import type { CalendarEvent } from '@/lib/scheduleSettingsTypes';
import { CALENDAR_EVENT_EFFECT_LABELS, CALENDAR_EVENT_TYPE_LABELS } from '@/platform/labels';
import { EVENT_EFFECT_BADGE, EVENT_TYPE_BADGE } from './calendarBadges';
import { formatEventDates } from './calendarMonth';
import { formatEventScope } from './calendarFormat';

/**
 * Список событий (Figma 2015:9781). Ширины фиксированных колонок — из макета,
 * «ДАТЫ» тянется.
 *
 * Скрытые события в макете не нарисованы, но в домене есть: строка приглушается,
 * иначе они выглядели бы как активные.
 */
export function EventsTable({
  events,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  events: CalendarEvent[];
  onEdit: (event: CalendarEvent) => void;
  onToggleStatus: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-slot-grid border-collapse text-left">
        <thead>
          <tr className="bg-gray-100 text-11 font-semibold text-subtle">
            <th scope="col" className="w-col-event-title px-6 py-3 font-semibold">
              НАЗВАНИЕ
            </th>
            <th scope="col" className="w-col-event-type py-3 font-semibold">
              ТИП СОБЫТИЯ
            </th>
            <th scope="col" className="py-3 font-semibold">
              ДАТЫ
            </th>
            <th scope="col" className="w-col-event-scope py-3 font-semibold">
              КЛАССЫ
            </th>
            <th scope="col" className="w-col-event-scope py-3 font-semibold">
              СТАТУС ЗАНЯТИЙ
            </th>
            <th scope="col" className="w-col-event-actions py-3 pr-6 text-right font-semibold">
              ДЕЙСТВИЯ
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const hidden = event.status === 'HIDDEN';
            return (
              <tr
                key={event.id}
                className={cx('border-b border-line last:border-b-0', hidden && 'opacity-55')}
              >
                <td className="px-6 py-3.5">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {event.title}
                  </span>
                  {hidden && <span className="text-11 text-subtle">Скрыто</span>}
                </td>
                <td className="py-3.5">
                  <Chip className={EVENT_TYPE_BADGE[event.type]}>
                    {CALENDAR_EVENT_TYPE_LABELS[event.type]}
                  </Chip>
                </td>
                <td className="py-3.5 text-sm text-muted">
                  {formatEventDates(event.dateFrom, event.dateTo)}
                </td>
                <td className="py-3.5 text-sm text-muted">{formatEventScope(event)}</td>
                <td className="py-3.5">
                  <Chip className={EVENT_EFFECT_BADGE[event.effect]}>
                    {CALENDAR_EVENT_EFFECT_LABELS[event.effect]}
                  </Chip>
                </td>
                <td className="py-3.5 pr-6">
                  <div className="flex items-center justify-end gap-3">
                    <IconButton label={`Редактировать «${event.title}»`} onClick={() => onEdit(event)}>
                      <Pencil className="size-4" aria-hidden />
                    </IconButton>
                    <IconButton
                      label={hidden ? `Показать «${event.title}»` : `Скрыть «${event.title}»`}
                      onClick={() => onToggleStatus(event)}
                    >
                      {hidden ? (
                        <Eye className="size-4" aria-hidden />
                      ) : (
                        <EyeOff className="size-4" aria-hidden />
                      )}
                    </IconButton>
                    <IconButton
                      label={`Удалить «${event.title}»`}
                      onClick={() => onDelete(event)}
                      danger
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </IconButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        'inline-block whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold',
        className,
      )}
    >
      {children}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        'inline-flex size-7 items-center justify-center rounded-md text-subtle transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
        danger ? 'hover:bg-no-lessons-bg hover:text-no-lessons-fg' : 'hover:bg-gray-100 hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
