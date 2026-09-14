import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, History, KeyRound, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { Schema } from '@/lib/apiSchemas';
import { ApiError } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePhysicalKeyDashboard, usePhysicalKeyHistory } from '@/hooks/queries';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { SearchInput } from '@/components/ui/SearchInput';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { formatDateTime } from '@/lib/format';
import {
  collapseKeyEvents,
  eventEmployee,
  eventGroupName,
  eventUnitLabel,
  keyAction,
  keyProblemLabel,
  type KeyEventGroup,
} from './keysModel';

type Tab = 'on-post' | 'issued' | 'history';
const HISTORY_PAGE_SIZE = 25;
const DASHBOARD_COLUMNS = ['w-1/3', 'w-24', 'w-1/4', 'flex-1'];
const HISTORY_COLUMNS = ['w-40', 'w-1/5', 'w-24', 'w-44', 'flex-1', 'w-48'];

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Не удалось загрузить ключи. Попробуйте ещё раз.';
}

export function KeysAdminPage() {
  const [params, setParams] = useSearchParams();
  const initialTab = params.get('tab');
  const tab: Tab = initialTab === 'issued' || initialTab === 'history' ? initialTab : 'on-post';
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [problem, setProblem] = useState(params.get('problem') ?? 'all');
  const [holder, setHolder] = useState(params.get('holder') ?? 'all');
  const [action, setAction] = useState(params.get('action') ?? 'all');
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);
  const settledQuery = useDebouncedValue(query.trim());

  useEffect(() => {
    setParams((current) => {
      if ((current.get('q') ?? '') === settledQuery) return current;
      const next = new URLSearchParams(current);
      if (settledQuery) next.set('q', settledQuery);
      else next.delete('q');
      return next;
    }, { replace: true });
  }, [settledQuery, setParams]);

  function patchParams(values: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value == null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setParams(next);
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Ключи</h1>
        <p className="mt-1 text-sm text-slate-500">Текущее состояние и журнал выдачи ключей</p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => patchParams({ tab: value === 'on-post' ? null : value, page: null })}
      >
        <TabsList className="gap-5">
          <TabsTrigger value="on-post">На посту</TabsTrigger>
          <TabsTrigger value="issued">Выданы</TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'history' ? (
        <HistoryPanel
          page={page}
          action={action}
          onActionChange={(value) => {
            setAction(value);
            patchParams({ action: value === 'all' ? null : value, page: null });
          }}
          onPageChange={(nextPage) => patchParams({ page: nextPage ? String(nextPage) : null })}
        />
      ) : (
        <DashboardPanel
          state={tab === 'issued' ? 'ISSUED' : 'ON_POST'}
          query={query}
          settledQuery={settledQuery}
          problem={problem}
          holder={holder}
          onQueryChange={setQuery}
          onProblemChange={(value) => {
            setProblem(value);
            patchParams({ problem: value === 'all' ? null : value });
          }}
          onHolderChange={(value) => {
            setHolder(value);
            patchParams({ holder: value === 'all' ? null : value });
          }}
        />
      )}
    </section>
  );
}

function DashboardPanel({
  state,
  query,
  settledQuery,
  problem,
  holder,
  onQueryChange,
  onProblemChange,
  onHolderChange,
}: {
  state: 'ON_POST' | 'ISSUED';
  query: string;
  settledQuery: string;
  problem: string;
  holder: string;
  onQueryChange: (value: string) => void;
  onProblemChange: (value: string) => void;
  onHolderChange: (value: string) => void;
}) {
  const filters = useMemo(
    () => ({
      state,
      query: settledQuery || undefined,
      hasProblem: problem === 'yes' ? true : problem === 'no' ? false : undefined,
      holderInactive: state === 'ISSUED' && holder === 'inactive' ? true : undefined,
    }),
    [state, settledQuery, problem, holder],
  );
  const dashboard = usePhysicalKeyDashboard(filters);
  const rows = useMemo(
    () =>
      (dashboard.data?.groups ?? []).flatMap((group) =>
        (group.units ?? []).map((unit) => ({ group, unit })),
      ),
    [dashboard.data],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder="Объект, ключ или сотрудник"
          className="min-w-72 flex-1"
        />
        <FilterSelect label="Проблема" value={problem} onChange={onProblemChange} className="w-48">
          <option value="all">Все ключи</option>
          <option value="yes">Требуют внимания</option>
          <option value="no">Без проблем</option>
        </FilterSelect>
        {state === 'ISSUED' && (
          <FilterSelect label="Держатель" value={holder} onChange={onHolderChange} className="w-52">
            <option value="all">Все сотрудники</option>
            <option value="inactive">Только неактивные</option>
          </FilterSelect>
        )}
      </div>

      <Summary data={dashboard.data?.summary} state={state} />

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <div className="min-w-[760px]">
          <DashboardHeader state={state} />
          {dashboard.isPending ? (
            <TableSkeleton columns={DASHBOARD_COLUMNS} rows={7} label={state === 'ON_POST' ? 'Загрузка ключей на посту' : 'Загрузка выданных ключей'} />
          ) : dashboard.isError ? (
            <ErrorBlock message={errorMessage(dashboard.error)} onRetry={() => void dashboard.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyBlock
              icon={<KeyRound className="h-7 w-7" />}
              title={settledQuery || problem !== 'all' || holder !== 'all' ? 'Ничего не найдено' : state === 'ON_POST' ? 'На посту пока нет ключей' : 'Нет выданных ключей'}
              description={settledQuery || problem !== 'all' || holder !== 'all' ? 'Измените поиск или фильтр.' : undefined}
            />
          ) : (
            <div>
              {rows.map(({ group, unit }) => (
                <DashboardRow key={unit.id} group={group} unit={unit} state={state} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Summary({ data, state }: { data?: Schema<'KeyDashboardSummary'>; state: 'ON_POST' | 'ISSUED' }) {
  return (
    <div className="flex flex-wrap gap-2 text-sm text-slate-600" aria-label="Сводка по отфильтрованным ключам">
      <span className="rounded-lg bg-slate-100 px-3 py-1.5">Всего: <strong className="text-slate-800">{data?.total ?? 0}</strong></span>
      <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700">{state === 'ON_POST' ? 'На посту' : 'Выданы'}: <strong>{state === 'ON_POST' ? data?.onPost ?? 0 : data?.issued ?? 0}</strong></span>
      {(data?.withProblem ?? 0) > 0 && <span className="rounded-lg bg-red-50 px-3 py-1.5 text-red-700">С проблемой: <strong>{data?.withProblem}</strong></span>}
    </div>
  );
}

function DashboardHeader({ state }: { state: 'ON_POST' | 'ISSUED' }) {
  return (
    <div className="grid grid-cols-[minmax(220px,1fr)_96px_minmax(180px,0.75fr)_minmax(180px,0.65fr)] bg-slate-50 px-5 py-3 text-10 font-semibold uppercase tracking-filter text-slate-400">
      <span>Объект</span><span>Ключ</span><span>{state === 'ISSUED' ? 'У кого' : 'Состояние'}</span><span>{state === 'ISSUED' ? 'Выдан' : 'Примечание'}</span>
    </div>
  );
}

function DashboardRow({ group, unit, state }: { group: Schema<'KeyGroupView'>; unit: Schema<'KeyUnitView'>; state: 'ON_POST' | 'ISSUED' }) {
  const problem = keyProblemLabel(unit.problem);
  return (
    <div className="grid min-h-14 grid-cols-[minmax(220px,1fr)_96px_minmax(180px,0.75fr)_minmax(180px,0.65fr)] items-center border-t border-slate-100 px-5 py-3 text-sm">
      <div className="min-w-0 pr-5"><p className="truncate font-medium text-slate-800">{group.name ?? unit.groupName ?? 'Без названия'}</p>{group.note && <p className="truncate text-xs text-slate-400">{group.note}</p>}</div>
      <span className="font-semibold text-slate-700">{unit.label ?? `№${unit.ordinal ?? '—'}`}</span>
      <div className="min-w-0 pr-4">
        {problem ? <Badge tone="red" dot>{problem}</Badge> : state === 'ISSUED' ? <p className="truncate text-slate-700">{unit.holder?.fullName ?? '—'}{unit.holder?.active === false && <span className="ml-1 text-xs text-slate-400">(неактивен)</span>}</p> : <Badge tone="green" dot>На посту</Badge>}
      </div>
      <span className="truncate text-slate-500">{state === 'ISSUED' ? formatDateTime(unit.issuedAt) : unit.note || '—'}</span>
    </div>
  );
}

function HistoryPanel({ page, action, onActionChange, onPageChange }: { page: number; action: string; onActionChange: (value: string) => void; onPageChange: (page: number) => void }) {
  const filters = useMemo(() => ({ page, size: HISTORY_PAGE_SIZE, action: action === 'all' ? undefined : action }), [page, action]);
  const history = usePhysicalKeyHistory(filters);
  const rows = history.data?.content ?? [];
  const eventGroups = useMemo(() => collapseKeyEvents(rows), [rows]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <FilterSelect label="Событие" value={action} onChange={onActionChange} className="w-60">
          <option value="all">Все события</option>
          <option value="ISSUED">Выдача</option><option value="RETURNED">Возврат</option><option value="TRANSFERRED">Передача</option>
          <option value="PROBLEM_SET">Отметка проблемы</option><option value="PROBLEM_CHANGED">Изменение проблемы</option><option value="PROBLEM_CLEARED">Снятие проблемы</option>
          <option value="UNIT_CREATED">Создание</option><option value="UNIT_RENAMED">Переименование</option><option value="UNIT_DELETED">Удаление</option>
        </FilterSelect>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[160px_minmax(170px,1fr)_96px_176px_minmax(180px,1fr)_192px] bg-slate-50 px-5 py-3 text-10 font-semibold uppercase tracking-filter text-slate-400">
            <span>Дата</span><span>Объект</span><span>Ключ</span><span>Действие</span><span>Сотрудник</span><span>Охрана</span>
          </div>
          {history.isPending ? <TableSkeleton columns={HISTORY_COLUMNS} rows={8} label="Загрузка истории ключей" /> : history.isError ? <ErrorBlock message={errorMessage(history.error)} onRetry={() => void history.refetch()} /> : eventGroups.length === 0 ? <EmptyBlock icon={<History className="h-7 w-7" />} title="История пока пуста" description={action !== 'all' ? 'Для выбранного типа событий записей нет.' : undefined} /> : eventGroups.map((group) => <HistoryRow key={group.key} group={group} />)}
        </div>
      </div>
      {!history.isError && (history.data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Показано {page * HISTORY_PAGE_SIZE + 1}–{Math.min((page + 1) * HISTORY_PAGE_SIZE, history.data?.totalElements ?? 0)} из {history.data?.totalElements ?? 0}</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<ChevronLeft className="h-4 w-4" />} disabled={history.isFetching || history.data?.first} onClick={() => onPageChange(Math.max(0, page - 1))}>Назад</Button>
            <span className="min-w-24 text-center">{page + 1} из {history.data?.totalPages}</span>
            <Button variant="secondary" size="sm" icon={<ChevronRight className="h-4 w-4" />} disabled={history.isFetching || history.data?.last} onClick={() => onPageChange(page + 1)}>Далее</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ group }: { group: KeyEventGroup }) {
  const event = group.first;
  const action = keyAction(event.action);
  return (
    <div className="grid min-h-14 grid-cols-[160px_minmax(170px,1fr)_96px_176px_minmax(180px,1fr)_192px] items-center border-t border-slate-100 px-5 py-3 text-sm">
      <span className="text-slate-500">{formatDateTime(event.createdAt)}</span>
      <span className="truncate pr-4 font-medium text-slate-800">{eventGroupName(group)}</span>
      <span className="font-semibold text-slate-700">{eventUnitLabel(group)}</span>
      <span><Badge tone={action.tone}>{action.label}</Badge></span>
      <span className="truncate pr-4 text-slate-700">{eventEmployee(event)}</span>
      <span className="truncate text-slate-500"><ShieldCheck className="mr-1.5 inline h-4 w-4" />{event.actor?.fullName ?? 'Система'}</span>
    </div>
  );
}
