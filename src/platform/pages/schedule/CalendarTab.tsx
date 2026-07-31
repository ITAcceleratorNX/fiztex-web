import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Plus, Search } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/format';
import type {
  CalendarEvent,
  CalendarEventFilters,
  CalendarEventStatus,
  CalendarEventType,
} from '@/lib/scheduleSettingsTypes';
import {
  useActivateCalendarEvent,
  useCalendarEvents,
  useDeleteCalendarEvent,
  useHideCalendarEvent,
} from '@/platform/hooks/useScheduleSettings';
import { CALENDAR_EVENT_TYPE_LABELS } from '@/platform/labels';
import { CalendarEventFormModal } from './CalendarEventFormModal';
import { EVENT_TYPE_ORDER } from './calendarBadges';
import { EventsMonthGrid } from './EventsMonthGrid';
import { EventsTable } from './EventsTable';
import { monthGridRange, monthOf, type YearMonth } from './calendarMonth';

const PAGE_SIZE = 20;
/** Месяц целиком грузится одной страницей — сетке пагинация не нужна. */
const MONTH_SIZE = 200;
const SEARCH_DEBOUNCE_MS = 300;

export type CalendarView = 'list' | 'calendar';

export type CalendarFilterState = {
  type: CalendarEventType | '';
  status: CalendarEventStatus | 'ALL';
  view: CalendarView;
  /** YYYY-MM — месяц календарного представления. */
  month: string;
  page: number;
};

export const DEFAULT_CALENDAR_FILTERS: CalendarFilterState = {
  type: '',
  status: 'ACTIVE',
  view: 'list',
  month: '',
  page: 0,
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Карточка «События» школьного календаря (Figma 2015:9752 — список,
 * 2015:10119 — календарь, 2015:10033 — пусто).
 */
export function CalendarTab({
  yearId,
  filters,
  onFiltersChange,
}: {
  yearId: number;
  filters: CalendarFilterState;
  onFiltersChange: (next: CalendarFilterState) => void;
}) {
  const toast = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const month: YearMonth = useMemo(
    () => monthOf(`${filters.month || currentMonth()}-01`),
    [filters.month],
  );
  const isCalendar = filters.view === 'calendar';

  const apiFilters: CalendarEventFilters = useMemo(() => {
    const base: CalendarEventFilters = {
      type: filters.type || undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
      title: debouncedSearch || undefined,
    };
    if (!isCalendar) return { ...base, page: filters.page, size: PAGE_SIZE };
    // Сетка показывает и хвосты соседних месяцев — грузим по её границам.
    const range = monthGridRange(month);
    return { ...base, dateFrom: range.from, dateTo: range.to, page: 0, size: MONTH_SIZE };
  }, [filters.type, filters.status, filters.page, debouncedSearch, isCalendar, month]);

  const query = useCalendarEvents(yearId, apiFilters);
  const hideMutation = useHideCalendarEvent(yearId);
  const activateMutation = useActivateCalendarEvent(yearId);
  const deleteMutation = useDeleteCalendarEvent(yearId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [statusTarget, setStatusTarget] = useState<CalendarEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);

  const events = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const filtersApplied = Boolean(filters.type || debouncedSearch) || filters.status !== 'ACTIVE';

  function patch(next: Partial<CalendarFilterState>) {
    onFiltersChange({ ...filters, ...next, page: next.page ?? 0 });
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  async function confirmStatus() {
    if (!statusTarget) return;
    try {
      if (statusTarget.status === 'ACTIVE') {
        await hideMutation.mutateAsync(statusTarget.id);
        toast.success('Событие скрыто');
      } else {
        await activateMutation.mutateAsync(statusTarget.id);
        toast.success('Событие активировано');
      }
      setStatusTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось изменить статус');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Событие удалено');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось удалить');
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">События</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5"
            role="group"
            aria-label="Представление событий"
          >
            <ViewTab active={!isCalendar} onClick={() => patch({ view: 'list' })}>
              Список
            </ViewTab>
            <ViewTab active={isCalendar} onClick={() => patch({ view: 'calendar' })}>
              Календарь
            </ViewTab>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-brand-500 px-4 py-2 text-13 font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            + Добавить событие
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр по типу события">
          <FilterPill active={filters.type === ''} onClick={() => patch({ type: '' })}>
            Все
          </FilterPill>
          {EVENT_TYPE_ORDER.map((type) => (
            <FilterPill
              key={type}
              active={filters.type === type}
              onClick={() => patch({ type })}
            >
              {CALENDAR_EVENT_TYPE_LABELS[type]}
            </FilterPill>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Скрытых событий в макете нет, но иначе они недостижимы из админки. */}
          <label className="flex items-center gap-2 text-13 text-muted">
            <input
              type="checkbox"
              checked={filters.status === 'ALL'}
              onChange={(e) => patch({ status: e.target.checked ? 'ALL' : 'ACTIVE' })}
              className="size-4 rounded border-subtle text-navy-700 focus-visible:ring-navy-700"
            />
            Показывать скрытые
          </label>
          <label className="flex w-filter-select items-center gap-2 rounded-lg border border-line px-3 py-2 transition focus-within:border-navy-700">
            <Search className="size-3.5 shrink-0 text-subtle" aria-hidden />
            <span className="sr-only">Поиск событий</span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Поиск событий"
              className="w-full min-w-0 bg-transparent text-13 text-ink outline-none placeholder:text-subtle"
            />
          </label>
        </div>
      </div>

      {query.isLoading && <LoadingBlock label="Загрузка календаря…" />}
      {query.isError && (
        <ErrorBlock
          message={
            query.error instanceof Error ? query.error.message : 'Не удалось загрузить события'
          }
          onRetry={() => void query.refetch()}
        />
      )}

      {!query.isLoading && !query.isError && (
        <>
          {isCalendar ? (
            <EventsMonthGrid
              month={month}
              events={events}
              onMonthChange={(next) =>
                patch({ month: `${next.year}-${String(next.month).padStart(2, '0')}` })
              }
              onEventClick={(event) => {
                setEditing(event);
                setFormOpen(true);
              }}
            />
          ) : events.length === 0 ? (
            <EmptyEvents filtersApplied={filtersApplied} onCreate={openCreate} onReset={() => patch({ ...DEFAULT_CALENDAR_FILTERS, view: filters.view })} />
          ) : (
            <>
              <EventsTable
                events={events}
                onEdit={(event) => {
                  setEditing(event);
                  setFormOpen(true);
                }}
                onToggleStatus={setStatusTarget}
                onDelete={setDeleteTarget}
              />
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 text-13 text-muted">
                  <span>
                    Стр. {filters.page + 1} из {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <PageButton
                      disabled={filters.page <= 0}
                      onClick={() => onFiltersChange({ ...filters, page: filters.page - 1 })}
                    >
                      Назад
                    </PageButton>
                    <PageButton
                      disabled={filters.page + 1 >= totalPages}
                      onClick={() => onFiltersChange({ ...filters, page: filters.page + 1 })}
                    >
                      Далее
                    </PageButton>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <CalendarEventFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        yearId={yearId}
        event={editing}
        onSaved={() => void query.refetch()}
      />

      <ConfirmDialog
        open={statusTarget != null}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.status === 'ACTIVE' ? 'Скрыть событие?' : 'Активировать событие?'}
        confirmLabel={statusTarget?.status === 'ACTIVE' ? 'Скрыть' : 'Активировать'}
        loading={hideMutation.isPending || activateMutation.isPending}
        message={
          statusTarget?.status === 'ACTIVE'
            ? 'Скрытое событие не участвует в активном календаре, но сохраняется в истории.'
            : 'Событие снова будет видно в активном календаре.'
        }
        onConfirm={() => void confirmStatus()}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Удалить событие?"
        confirmLabel="Удалить навсегда"
        danger
        loading={deleteMutation.isPending}
        message={
          <div className="space-y-2">
            <p>«{deleteTarget?.title}» будет удалено безвозвратно.</p>
            <p className="text-muted">
              Если нужно лишь убрать из актуального календаря — лучше выбрать «Скрыть».
            </p>
          </div>
        }
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}

/** «Событий пока нет» (2015:10033) и результат фильтра без совпадений. */
function EmptyEvents({
  filtersApplied,
  onCreate,
  onReset,
}: {
  filtersApplied: boolean;
  onCreate: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-100">
        <CalendarRange className="size-6 text-subtle" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-ink">
          {filtersApplied ? 'Ничего не найдено' : 'Событий пока нет'}
        </p>
        <p className="max-w-state-text-wide text-13 text-muted">
          {filtersApplied
            ? 'Измените фильтры или очистите поиск — в году есть другие события.'
            : 'Добавьте первое событие, чтобы управлять расписанием'}
        </p>
      </div>
      {filtersApplied ? (
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-line px-4 py-2.5 text-13 font-semibold text-muted transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"
        >
          Сбросить фильтры
        </button>
      ) : (
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-13 font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Plus className="size-4" aria-hidden />
          Добавить событие
        </button>
      )}
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'rounded-md px-3 py-1.5 text-13 transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
        active ? 'bg-white font-semibold text-navy-700 shadow-slot' : 'text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'rounded-full border px-3 py-1.5 text-13 font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
        active
          ? 'border-navy-700 bg-pill-active text-navy-700'
          : 'border-line bg-white text-muted hover:bg-gray-50',
      )}
    >
      {children}
    </button>
  );
}

function PageButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'rounded-lg border border-line px-3 py-1.5 text-13 font-medium text-muted transition',
        'hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
        'disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}
