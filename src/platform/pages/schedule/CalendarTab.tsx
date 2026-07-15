import { useMemo, useState, type ReactNode } from 'react';
import { CalendarRange, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Field';
import { DateRangeInput } from '@/components/ui/DateRangeInput';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
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
import {
  CALENDAR_EVENT_EFFECT_LABELS,
  CALENDAR_EVENT_STATUS_LABELS,
  CALENDAR_EVENT_TYPE_DOT,
  CALENDAR_EVENT_TYPE_LABELS,
} from '@/platform/labels';
import { CalendarEventFormModal } from './CalendarEventFormModal';
import {
  formatEventDateRange,
  formatEventScope,
  groupEventsByMonth,
} from './calendarFormat';
import { cx } from '@/lib/format';

const EVENT_TYPES: CalendarEventType[] = [
  'HOLIDAY',
  'VACATION',
  'NON_SCHOOL_DAY',
  'EXAM_DAY',
  'OTHER',
];

export type CalendarFilterState = {
  type: CalendarEventType | '';
  status: CalendarEventStatus | 'ALL';
  dateFrom: string;
  dateTo: string;
  page: number;
};

export const DEFAULT_CALENDAR_FILTERS: CalendarFilterState = {
  type: '',
  status: 'ACTIVE',
  dateFrom: '',
  dateTo: '',
  page: 0,
};

const PAGE_SIZE = 20;

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
  const apiFilters: CalendarEventFilters = useMemo(
    () => ({
      type: filters.type || undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      page: filters.page,
      size: PAGE_SIZE,
    }),
    [filters],
  );

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
  const totalElements = query.data?.totalElements ?? 0;
  const monthGroups = useMemo(() => groupEventsByMonth(events), [events]);

  // Backend defaults omitted status → ACTIVE, so probe both to know if the year has any events.
  const probeActive = useCalendarEvents(yearId, { status: 'ACTIVE', page: 0, size: 1 });
  const probeHidden = useCalendarEvents(yearId, { status: 'HIDDEN', page: 0, size: 1 });
  const probesReady = !probeActive.isLoading && !probeHidden.isLoading;
  const catalogEmpty =
    probesReady &&
    (probeActive.data?.totalElements ?? 0) === 0 &&
    (probeHidden.data?.totalElements ?? 0) === 0;

  const dateRangeInvalid =
    Boolean(filters.dateFrom) &&
    Boolean(filters.dateTo) &&
    filters.dateTo < filters.dateFrom;

  function patchFilters(patch: Partial<CalendarFilterState>) {
    const next: CalendarFilterState = {
      ...filters,
      ...patch,
      page: patch.page ?? 0,
    };
    if (next.dateFrom && next.dateTo && next.dateTo < next.dateFrom) {
      // Keep a valid LocalDate range without TZ math — clamp the other bound.
      if (patch.dateFrom !== undefined) next.dateTo = next.dateFrom;
      else if (patch.dateTo !== undefined) next.dateFrom = next.dateTo;
    }
    onFiltersChange(next);
  }

  function resetFilters() {
    onFiltersChange({ ...DEFAULT_CALENDAR_FILTERS });
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
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="sm:w-48">
          <label className="label-base">Тип</label>
          <Select
            value={filters.type}
            onChange={(e) =>
              patchFilters({ type: e.target.value as CalendarEventType | '' })
            }
          >
            <option value="">Все типы</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CALENDAR_EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-40">
          <label className="label-base">Статус</label>
          <Select
            value={filters.status}
            onChange={(e) =>
              patchFilters({ status: e.target.value as CalendarEventStatus | 'ALL' })
            }
          >
            <option value="ACTIVE">Активные</option>
            <option value="HIDDEN">Скрытые</option>
            <option value="ALL">Все</option>
          </Select>
        </div>
        <DateRangeInput
          from={filters.dateFrom}
          to={filters.dateTo}
          onFromChange={(dateFrom) => patchFilters({ dateFrom })}
          onToChange={(dateTo) => patchFilters({ dateTo })}
          error={dateRangeInvalid ? 'Дата «по» должна быть не раньше даты «с»' : undefined}
        />
        <Button variant="secondary" size="sm" onClick={resetFilters}>
          Сброс
        </Button>
        <Button
          icon={<Plus className="h-4 w-4" />}
          className="lg:ml-auto"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          Добавить событие
        </Button>
      </div>

      {query.isLoading && <LoadingBlock label="Загрузка календаря…" />}
      {query.isError && (
        <ErrorBlock
          message={
            query.error instanceof Error
              ? query.error.message
              : 'Не удалось загрузить события'
          }
          onRetry={() => void query.refetch()}
        />
      )}

      {!query.isLoading && !query.isError && events.length === 0 && !probesReady && (
        <LoadingBlock label="Проверяем календарь…" />
      )}

      {!query.isLoading && !query.isError && events.length === 0 && probesReady && catalogEmpty && (
        <div className="card">
          <EmptyBlock
            icon={<CalendarRange className="h-7 w-7" />}
            title="Событий пока нет"
            description="Добавьте праздник, каникулы или неучебный день."
            action={
              <Button
                icon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Добавить событие
              </Button>
            }
          />
        </div>
      )}

      {!query.isLoading &&
        !query.isError &&
        events.length === 0 &&
        probesReady &&
        !catalogEmpty && (
        <div className="card">
          <EmptyBlock
            title="Ничего не найдено"
            description="Измените фильтры или сбросьте их — в году есть другие события."
            action={
              <Button variant="secondary" onClick={resetFilters}>
                Сбросить фильтры
              </Button>
            }
          />
        </div>
      )}

      {!query.isLoading && !query.isError && events.length > 0 && (
        <div className="space-y-6">
          {monthGroups.map((group) => (
            <div key={group.key}>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                {group.title}
              </h3>
              <div className="card overflow-hidden p-0">
                <ul className="divide-y divide-slate-50">
                  {group.events.map((event) => (
                    <li
                      key={event.id}
                      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span
                          className={cx(
                            'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                            CALENDAR_EVENT_TYPE_DOT[event.type],
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{event.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge tone="gray">{CALENDAR_EVENT_TYPE_LABELS[event.type]}</Badge>
                            <span className="text-xs text-slate-500">
                              {formatEventDateRange(event.dateFrom, event.dateTo)}
                            </span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-500">
                              {formatEventScope(event)}
                            </span>
                            <Badge tone={event.effect === 'NO_LESSONS' ? 'red' : 'blue'}>
                              {CALENDAR_EVENT_EFFECT_LABELS[event.effect]}
                            </Badge>
                            <Badge tone={event.status === 'ACTIVE' ? 'green' : 'gray'} dot>
                              {CALENDAR_EVENT_STATUS_LABELS[event.status]}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1 self-end sm:self-center">
                        <IconBtn
                          label="Редактировать"
                          onClick={() => {
                            setEditing(event);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn
                          label={event.status === 'ACTIVE' ? 'Скрыть' : 'Активировать'}
                          onClick={() => setStatusTarget(event)}
                        >
                          {event.status === 'ACTIVE' ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </IconBtn>
                        <IconBtn label="Удалить" onClick={() => setDeleteTarget(event)}>
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
              <span>
                Стр. {filters.page + 1} из {totalPages} · {totalElements} событий
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={filters.page <= 0}
                  onClick={() => onFiltersChange({ ...filters, page: filters.page - 1 })}
                >
                  Назад
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={filters.page + 1 >= totalPages}
                  onClick={() => onFiltersChange({ ...filters, page: filters.page + 1 })}
                >
                  Далее
                </Button>
              </div>
            </div>
          )}
        </div>
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
            <p>
              «{deleteTarget?.title}» будет удалено безвозвратно.
            </p>
            <p className="text-slate-500">
              Если нужно лишь убрать из актуального календаря — лучше выбрать «Скрыть».
            </p>
          </div>
        }
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
    >
      {children}
    </button>
  );
}
