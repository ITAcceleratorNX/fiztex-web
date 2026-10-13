import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { todayIso } from '@/lib/gradeCorrectionModel';
import { addDays, mondayOf, weekDates, weekLabel } from '@/lib/oneTimeEventModel';
import { ONE_TIME_EVENTS_KEY, oneTimeEventsApi, type OneTimeEvent } from '@/lib/oneTimeEventsApi';
import { OneTimeEventFormModal } from './OneTimeEventFormModal';
import { OneTimeEventViewModal } from './OneTimeEventViewModal';

/**
 * Разовые события на экране расписания: неделя сетки, события класса за неё и оба окна.
 *
 * Вынесено из страницы целиком: у страницы и так два десятка состояний конструктора, а здесь
 * своё — неделя и открытое событие. События видны только на действующей публикации
 * ({@code showOnGrid}): у черновика нет дат, это шаблон недели.
 */
export function useScheduleOneTimeEvents({
  yearId,
  classId,
  showOnGrid,
}: {
  yearId: number | null;
  classId: number | null;
  showOnGrid: boolean;
}) {
  const [monday, setMonday] = useState(() => mondayOf(todayIso()));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OneTimeEvent | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);

  const enabled = showOnGrid && classId != null;
  const sunday = addDays(monday, 6);
  const events = useQuery({
    queryKey: [...ONE_TIME_EVENTS_KEY, 'class', classId, monday],
    queryFn: ({ signal }) => oneTimeEventsApi.classSchedule(classId!, monday, sunday, signal),
    enabled,
  });

  const dates = useMemo(() => weekDates(monday), [monday]);

  const weekBar = enabled ? (
    <div className="flex flex-wrap items-center gap-2 pl-1">
      <button
        type="button"
        aria-label="Предыдущая неделя"
        onClick={() => setMonday((m) => addDays(m, -7))}
        className="flex size-8 items-center justify-center rounded-lg border border-line bg-white text-muted transition hover:text-navy-700"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-[132px] text-center text-13 font-semibold text-ink">{weekLabel(monday)}</span>
      <button
        type="button"
        aria-label="Следующая неделя"
        onClick={() => setMonday((m) => addDays(m, 7))}
        className="flex size-8 items-center justify-center rounded-lg border border-line bg-white text-muted transition hover:text-navy-700"
      >
        <ChevronRight className="size-4" />
      </button>
      {monday !== mondayOf(todayIso()) && (
        <button
          type="button"
          onClick={() => setMonday(mondayOf(todayIso()))}
          className="rounded-lg px-2 py-1 text-13 font-semibold text-navy-700 hover:bg-info-bg"
        >
          Текущая неделя
        </button>
      )}
      {events.isFetching && <Loader2 className="size-4 animate-spin text-muted" aria-label="Загружаем события" />}
      {events.isError && (
        <span className="flex items-center gap-2 text-13 text-red-600">
          {events.error instanceof ApiError ? events.error.message : 'Не удалось загрузить разовые события'}
          <button type="button" className="font-semibold underline" onClick={() => void events.refetch()}>
            Повторить
          </button>
        </span>
      )}
    </div>
  ) : null;

  const gridProps = enabled
    ? { dates, oneTimeEvents: events.data ?? [], onOpenEvent: (id: number) => setViewId(id) }
    : {};

  const modals = yearId != null ? (
    <>
      <OneTimeEventFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        yearId={yearId}
        event={editing}
        defaultDate={monday <= todayIso() && todayIso() <= sunday ? todayIso() : monday}
        defaultClassId={classId != null ? String(classId) : undefined}
        onSaved={(saved) => {
          setFormOpen(false);
          setEditing(null);
          // Сетка переходит на неделю события: иначе созданное на другую дату не было бы видно.
          if (saved.date) setMonday(mondayOf(saved.date));
        }}
      />
      <OneTimeEventViewModal
        eventId={viewId}
        onClose={() => setViewId(null)}
        onEdit={(event) => {
          setViewId(null);
          setEditing(event);
          setFormOpen(true);
        }}
      />
    </>
  ) : null;

  return {
    weekBar,
    gridProps,
    modals,
    openCreate: () => {
      setEditing(null);
      setFormOpen(true);
    },
  };
}
