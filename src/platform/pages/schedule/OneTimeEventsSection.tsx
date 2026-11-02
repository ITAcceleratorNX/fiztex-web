import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { todayIso } from '@/lib/gradeCorrectionModel';
import { audienceLabel, longDate, timeRange } from '@/lib/oneTimeEventModel';
import { ONE_TIME_EVENTS_KEY, oneTimeEventsApi, type OneTimeEvent } from '@/lib/oneTimeEventsApi';
import { OneTimeEventFormModal } from './OneTimeEventFormModal';
import { OneTimeEventViewModal } from './OneTimeEventViewModal';

const PAGE_SIZE = 20;

/**
 * Разовые мероприятия в школьном календаре (QA B3-008).
 *
 * <p>События календаря — целые дни (каникулы, праздники), и времени у них нет. Мероприятие на
 * часть дня — собрание, линейка, экскурсия — это разовое событие расписания: дата, начало,
 * окончание и охват «вся школа / параллель / классы». Раньше его можно было завести только из
 * недельной сетки расписания, и в календаре, где его искали, формы со временем не было вовсе.
 *
 * <p>Форма та же, что у сетки (`OneTimeEventFormModal`), — второй формы с другими правилами не
 * заводится. После сохранения открывается карточка события: кого оно затрагивает и какие уроки
 * перекрывает, считает бэкенд, постоянная сетка расписания не меняется.
 */
export function OneTimeEventsSection({ yearId }: { yearId: number }) {
  const [showPast, setShowPast] = useState(false);
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OneTimeEvent | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
  const today = todayIso();

  const query = useQuery({
    queryKey: [...ONE_TIME_EVENTS_KEY, 'year', yearId, showPast, page],
    queryFn: ({ signal }) => oneTimeEventsApi.list(
      { academicYearId: yearId, dateFrom: showPast ? undefined : today, status: 'ACTIVE', page, size: PAGE_SIZE },
      signal,
    ),
  });
  const events = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6" aria-labelledby="one-time-events-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="one-time-events-heading" className="text-base font-semibold text-ink">Разовые мероприятия</h2>
          <p className="mt-1 text-13 text-muted">
            На часть учебного дня: дата, время и охват. Ложатся поверх расписания — постоянная сетка не меняется.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-13 text-muted">
            <input
              type="checkbox"
              checked={showPast}
              onChange={(e) => { setShowPast(e.target.checked); setPage(0); }}
              className="size-4 rounded border-subtle text-navy-700 focus-visible:ring-navy-700"
            />
            Показывать прошедшие
          </label>
          <Button size="sm" onClick={openCreate}>+ Разовое мероприятие</Button>
        </div>
      </div>

      {query.isLoading && <LoadingBlock label="Загружаем мероприятия…" />}
      {query.isError && (
        <ErrorBlock message="Не удалось загрузить разовые мероприятия" onRetry={() => void query.refetch()} />
      )}
      {!query.isLoading && !query.isError && events.length === 0 && (
        <EmptyBlock
          title={showPast ? 'Мероприятий в этом году нет' : 'Предстоящих мероприятий нет'}
          description="Например, общешкольная линейка или родительское собрание параллели."
        />
      )}

      {events.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line" aria-label="Разовые мероприятия">
          {events.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => event.id != null && setViewId(event.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-neutral-bg"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">{event.title}</span>
                  <span className="text-13 text-muted">{audienceLabel(event)}</span>
                </span>
                <span className="flex items-center gap-2 text-13 text-ink">
                  {event.date && <span>{longDate(event.date)}</span>}
                  <span className="inline-flex items-center gap-1 rounded bg-info-bg px-2 py-0.5 text-link">
                    <Clock className="size-3.5" aria-hidden />
                    {timeRange(event)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-13 text-muted">
          <span>Стр. {page + 1} из {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 0} onClick={() => setPage(page - 1)}>Назад</Button>
            <Button size="sm" variant="secondary" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Далее</Button>
          </div>
        </div>
      )}

      <OneTimeEventFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        yearId={yearId}
        event={editing}
        defaultDate={today}
        onSaved={(saved) => {
          setFormOpen(false);
          setEditing(null);
          // Показываем то, что сохранил сервер: охват, затронутых и перекрытые уроки.
          if (saved.id != null) setViewId(saved.id);
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
    </section>
  );
}
