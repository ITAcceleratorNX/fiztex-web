import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Clock, LogIn, MonitorOff, WifiOff } from 'lucide-react';
import { useMonitoringAttempts } from '@/hooks/queries';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { AttemptLogsModal } from '@/pages/modals/AttemptLogsModal';
import { formatDateTime, pluralRu, cx } from '@/lib/format';
import { ApiError } from '@/lib/api';
import type { MonitoringAttemptItem } from '@/lib/types';

export type AttemptsStatusFilter = 'ALL' | 'NOT_STARTED' | 'IN_PROGRESS' | 'AWAITING_REVIEW';

const STATUS_OPTIONS: { value: AttemptsStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Статус: Все' },
  { value: 'NOT_STARTED', label: 'Не начат' },
  { value: 'IN_PROGRESS', label: 'В процессе' },
  { value: 'AWAITING_REVIEW', label: 'Ожидает проверки' },
];

function statusBadge(status: MonitoringAttemptItem['status'], retakeAllowed: boolean) {
  if (retakeAllowed) {
    return <Badge tone="purple" dot>Повтор разрешён</Badge>;
  }
  if (status === 'NOT_STARTED') return <Badge tone="gray" dot>Не начат</Badge>;
  if (status === 'IN_PROGRESS') return <Badge tone="blue" dot>В процессе</Badge>;
  if (status === 'AWAITING_REVIEW') return <Badge tone="amber" dot>Ожидает проверки</Badge>;
  if (status === 'REVIEWED') return <Badge tone="green" dot>Проверено</Badge>;
  if (status === 'OPEN_FOR_VIEWING') return <Badge tone="green" dot>Результат открыт</Badge>;
  return <Badge tone="gray">{status}</Badge>;
}

function EventFlags({ row }: { row: MonitoringAttemptItem }) {
  const flags = [
    { on: row.focusLost, icon: MonitorOff, label: 'Выход из окна' },
    { on: row.reentry, icon: LogIn, label: 'Повторный вход' },
    { on: row.timeExpired, icon: Clock, label: 'Истекло время' },
    { on: row.connectionIssue, icon: WifiOff, label: 'Проблема с сохранением' },
  ].filter((f) => f.on);

  if (flags.length === 0) {
    return <span className="text-sm text-slate-400">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {flags.map(({ icon: Icon, label }) => (
        <span
          key={label}
          title={label}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-200"
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">{label}</span>
        </span>
      ))}
    </div>
  );
}

export function AttemptsTab({
  statusFilter,
  onStatusFilterChange,
  focusAttemptId,
  onFocusHandled,
}: {
  statusFilter: AttemptsStatusFilter;
  onStatusFilterChange: (value: AttemptsStatusFilter) => void;
  focusAttemptId: number | null;
  onFocusHandled: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MonitoringAttemptItem | null>(null);

  const attemptsQuery = useMonitoringAttempts(statusFilter);
  const { data, isLoading, isError, error, refetch, isSuccess, fetchNextPage, hasNextPage, isFetchingNextPage } =
    attemptsQuery;

  const allRows = useMemo(
    () => data?.pages.flatMap((page) => page.content) ?? [],
    [data],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((row) => {
      if (!q) return true;
      return (
        row.applicantName.toLowerCase().includes(q) ||
        row.testTitle.toLowerCase().includes(q)
      );
    });
  }, [allRows, search]);

  const totalLoaded = allRows.length;
  const totalElements = data?.pages[0]?.totalElements ?? totalLoaded;

  useEffect(() => {
    if (focusAttemptId == null) return;
    const match = allRows.find((row) => row.attemptId === focusAttemptId);
    if (match) {
      setSelected(match);
      onFocusHandled();
      return;
    }
    if (hasNextPage && !isFetchingNextPage && !isLoading) {
      fetchNextPage();
    }
  }, [focusAttemptId, allRows, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage, onFocusHandled]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по ФИО…"
          className="w-full max-w-xs"
        />
        <Select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as AttemptsStatusFilter)}
          className="h-11 w-auto"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <LoadingBlock label="Загрузка попыток…" />
        ) : isError ? (
          <ErrorBlock
            message={error instanceof ApiError ? error.message : 'Ошибка загрузки'}
            onRetry={refetch}
          />
        ) : rows.length === 0 ? (
          <EmptyBlock
            icon={<ClipboardList className="h-7 w-7" />}
            title="Попыток не найдено"
            description="Измените фильтр или дождитесь, пока поступающий начнёт тест."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3.5">Поступающий</th>
                  <th className="px-6 py-3.5">Тест</th>
                  <th className="px-6 py-3.5">Статус</th>
                  <th className="px-6 py-3.5">Начало</th>
                  <th className="px-6 py-3.5">Завершение</th>
                  <th className="px-6 py-3.5">Прогресс</th>
                  <th className="px-6 py-3.5">События</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row) => (
                  <tr
                    key={row.attemptId ?? `assignment-${row.assignmentId}`}
                    onClick={() => row.attemptId != null && setSelected(row)}
                    className={cx(
                      'transition',
                      row.attemptId != null && 'cursor-pointer hover:bg-slate-50/70',
                      focusAttemptId != null && row.attemptId === focusAttemptId && 'bg-brand-50/50',
                    )}
                  >
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{row.applicantName}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{row.testTitle}</td>
                    <td className="px-6 py-3.5">{statusBadge(row.status, row.retakeAllowed)}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-500">{formatDateTime(row.startedAt)}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-500">{formatDateTime(row.finishedAt)}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">
                      {row.questionCount > 0
                        ? `${row.answeredCount}/${row.questionCount}`
                        : '—'}
                    </td>
                    <td className="px-6 py-3.5">
                      <EventFlags row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isSuccess && rows.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-3 text-sm text-slate-400">
            Показано {totalLoaded} из {totalElements}{' '}
            {pluralRu(totalElements, ['назначения', 'назначений', 'назначений'])}
          </div>
        )}

        {hasNextPage && (
          <div className="border-t border-slate-100 px-6 py-3 flex justify-center">
            <Button
              size="sm"
              variant="secondary"
              loading={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              Показать ещё
            </Button>
          </div>
        )}
      </div>

      <AttemptLogsModal
        open={selected != null}
        attempt={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
