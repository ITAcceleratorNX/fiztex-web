import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, History, Laptop, Plus, UserCog } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { SearchInput } from '@/components/ui/SearchInput';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useEquipmentDashboard, useEquipmentHistory, useEquipmentItems } from '@/hooks/queries';
import { cx, formatDateTime } from '@/lib/format';
import type { Schema } from '@/lib/apiSchemas';
import { EquipmentIssueModal } from './EquipmentIssueModal';
import { EquipmentItemFormModal } from './EquipmentItemFormModal';
import { EquipmentUnitCardModal } from './EquipmentUnitCardModal';
import {
  collapseEquipmentEvents,
  equipmentAction,
  equipmentProblemLabel,
  errorMessage,
  eventEmployee,
  eventItemName,
  eventItemRename,
  eventUnitLabel,
  type EquipmentEventGroup,
  type EquipmentUnit,
} from './equipmentModel';

type Tab = 'in-stock' | 'issued' | 'history';

const HISTORY_PAGE_SIZE = 25;
const STOCK_COLUMNS = ['w-8', 'w-1/3', 'w-40', 'w-1/4', 'flex-1'];
const ISSUED_COLUMNS = ['w-1/3', 'w-40', 'w-1/4', 'w-40', 'flex-1'];
const HISTORY_COLUMNS = ['w-40', 'w-1/5', 'w-32', 'w-44', 'flex-1', 'w-48'];

const STOCK_GRID =
  'grid-cols-[32px_minmax(200px,1fr)_minmax(140px,0.6fr)_minmax(160px,0.7fr)_minmax(150px,0.6fr)]';
const ISSUED_GRID =
  'grid-cols-[minmax(200px,1fr)_minmax(140px,0.6fr)_minmax(170px,0.8fr)_minmax(150px,0.6fr)_minmax(150px,0.6fr)]';
const HISTORY_GRID =
  'grid-cols-[160px_minmax(170px,1fr)_120px_176px_minmax(160px,1fr)_minmax(150px,0.7fr)]';

/**
 * Техника и инвентарь — раздел Super Admin (ТЗ «Техника и инвентарь» §8).
 *
 * <p>Собран на дашборде ключей: те же три вкладки, та же таблица, те же состояния экрана.
 * Отличие одно и оно принципиальное — здесь не только смотрят. У ключей операции живут в
 * мобильном приложении охраны, а технику ведёт тот же человек, который сидит в панели:
 * §2 даёт Super Admin полный доступ на обеих платформах, и раздел, из которого нельзя
 * поставить вещь на учёт, был бы половиной модуля.
 *
 * <p>Само действие живёт в карточке экземпляра, а в таблице — только выбор и выдача
 * пачкой: §7.2 разрешает выдать несколько экземпляров одним действием, и это единственная
 * операция, ради которой строки отмечают галочками.
 */
export function EquipmentAdminPage() {
  useDocumentTitle('Техника и инвентарь');

  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const tab: Tab = rawTab === 'issued' || rawTab === 'history' ? rawTab : 'in-stock';

  const [query, setQuery] = useState(params.get('q') ?? '');
  const settledQuery = useDebouncedValue(query.trim());
  const itemFilter = params.get('item') ?? 'all';
  const problem = params.get('problem') ?? 'all';
  const holder = params.get('holder') ?? 'all';
  const action = params.get('action') ?? 'all';
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);

  const [formOpen, setFormOpen] = useState(false);
  const [cardUnitId, setCardUnitId] = useState<number | null>(null);
  const [issueTarget, setIssueTarget] = useState<
    { mode: 'issue' | 'transfer'; unitIds: number[]; subtitle: string; excludeAccountId?: number } | null
  >(null);
  const [selected, setSelected] = useState<number[]>([]);

  const items = useEquipmentItems();

  useEffect(() => {
    setParams((current) => {
      if ((current.get('q') ?? '') === settledQuery) return current;
      const next = new URLSearchParams(current);
      if (settledQuery) next.set('q', settledQuery);
      else next.delete('q');
      return next;
    }, { replace: true });
  }, [settledQuery, setParams]);

  // Выбор живёт внутри одной вкладки: «Выдано» и «История» не про него, и унесённый
  // туда набор галочек означал бы выдачу того, чего на экране уже нет.
  useEffect(() => setSelected([]), [tab, settledQuery, itemFilter, problem]);

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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Техника и инвентарь</h1>
          <p className="mt-1 text-sm text-slate-500">
            Учёт школьной техники: что на месте, у кого на руках и что с ней происходило
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
          Добавить позицию
        </Button>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) =>
          patchParams({ tab: value === 'in-stock' ? null : value, page: null })
        }
      >
        <TabsList className="gap-5">
          <TabsTrigger value="in-stock">В наличии</TabsTrigger>
          <TabsTrigger value="issued">Выдано</TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'history' ? (
        <HistoryPanel
          page={page}
          action={action}
          itemFilter={itemFilter}
          items={items.data ?? []}
          onActionChange={(value) => patchParams({ action: value === 'all' ? null : value, page: null })}
          onItemChange={(value) => patchParams({ item: value === 'all' ? null : value, page: null })}
          onPageChange={(nextPage) => patchParams({ page: nextPage ? String(nextPage) : null })}
        />
      ) : (
        <DashboardPanel
          state={tab === 'issued' ? 'ISSUED' : 'IN_STOCK'}
          query={query}
          settledQuery={settledQuery}
          itemFilter={itemFilter}
          problem={problem}
          holder={holder}
          items={items.data ?? []}
          selected={selected}
          onQueryChange={setQuery}
          onItemChange={(value) => patchParams({ item: value === 'all' ? null : value })}
          onProblemChange={(value) => patchParams({ problem: value === 'all' ? null : value })}
          onHolderChange={(value) => patchParams({ holder: value === 'all' ? null : value })}
          onToggle={(unitId) =>
            setSelected((current) =>
              current.includes(unitId)
                ? current.filter((id) => id !== unitId)
                : [...current, unitId],
            )
          }
          onOpenUnit={setCardUnitId}
          onIssueSelected={(subtitle) =>
            setIssueTarget({ mode: 'issue', unitIds: selected, subtitle })
          }
        />
      )}

      <EquipmentItemFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        items={items.data ?? []}
      />

      <EquipmentUnitCardModal
        unitId={cardUnitId}
        onClose={() => setCardUnitId(null)}
        onIssue={(unit) => {
          setCardUnitId(null);
          setIssueTarget({
            mode: 'issue',
            unitIds: [unit.id!],
            subtitle: unitTitle(unit),
          });
        }}
        onTransfer={(unit) => {
          setCardUnitId(null);
          setIssueTarget({
            mode: 'transfer',
            unitIds: [unit.id!],
            subtitle: unitTitle(unit),
            excludeAccountId: unit.holder?.accountId,
          });
        }}
      />

      {issueTarget && (
        <EquipmentIssueModal
          open
          onClose={() => {
            setIssueTarget(null);
            setSelected([]);
          }}
          mode={issueTarget.mode}
          unitIds={issueTarget.unitIds}
          subtitle={issueTarget.subtitle}
          excludeAccountId={issueTarget.excludeAccountId}
        />
      )}
    </section>
  );
}

function unitTitle(unit: EquipmentUnit): string {
  return [unit.itemName, unit.inventoryNumber].filter(Boolean).join(' · ');
}

function DashboardPanel({
  state,
  query,
  settledQuery,
  itemFilter,
  problem,
  holder,
  items,
  selected,
  onQueryChange,
  onItemChange,
  onProblemChange,
  onHolderChange,
  onToggle,
  onOpenUnit,
  onIssueSelected,
}: {
  state: 'IN_STOCK' | 'ISSUED';
  query: string;
  settledQuery: string;
  itemFilter: string;
  problem: string;
  holder: string;
  items: Schema<'EquipmentItemOptionView'>[];
  selected: number[];
  onQueryChange: (value: string) => void;
  onItemChange: (value: string) => void;
  onProblemChange: (value: string) => void;
  onHolderChange: (value: string) => void;
  onToggle: (unitId: number) => void;
  onOpenUnit: (unitId: number) => void;
  onIssueSelected: (subtitle: string) => void;
}) {
  const filters = useMemo(
    () => ({
      state,
      query: settledQuery || undefined,
      itemId: itemFilter === 'all' ? undefined : Number(itemFilter),
      hasProblem: problem === 'yes' ? true : problem === 'no' ? false : undefined,
      holderInactive: state === 'ISSUED' && holder === 'inactive' ? true : undefined,
    }),
    [state, settledQuery, itemFilter, problem, holder],
  );
  const dashboard = useEquipmentDashboard(filters);
  const rows = useMemo(
    () =>
      (dashboard.data?.items ?? []).flatMap((item) =>
        (item.units ?? []).map((unit) => ({ item, unit })),
      ),
    [dashboard.data],
  );
  const filtered = settledQuery !== '' || itemFilter !== 'all' || problem !== 'all' || holder !== 'all';
  const issuing = state === 'IN_STOCK';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder="Позиция, инвентарный номер или сотрудник"
          className="min-w-72 flex-1"
        />
        <FilterSelect label="Позиция" value={itemFilter} onChange={onItemChange} className="w-56">
          <option value="all">Все позиции</option>
          {items.map((item) => (
            <option key={item.id} value={String(item.id)}>
              {item.name ?? ''}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Проблема" value={problem} onChange={onProblemChange} className="w-48">
          <option value="all">Вся техника</option>
          <option value="yes">Требует внимания</option>
          <option value="no">Без проблем</option>
        </FilterSelect>
        {state === 'ISSUED' && (
          <FilterSelect label="Держатель" value={holder} onChange={onHolderChange} className="w-52">
            <option value="all">Все сотрудники</option>
            <option value="inactive">Только неактивные</option>
          </FilterSelect>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Summary data={dashboard.data?.summary} state={state} />
        {issuing && selected.length > 0 && (
          <Button
            size="sm"
            className="ml-auto"
            onClick={() =>
              onIssueSelected(
                selected.length === 1
                  ? (rows.find(({ unit }) => unit.id === selected[0]) &&
                      unitTitle(rows.find(({ unit }) => unit.id === selected[0])!.unit)) ||
                      'Выбран 1 экземпляр'
                  : `Выбрано экземпляров: ${selected.length}`,
              )
            }
          >
            Выдать · {selected.length}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <div className="min-w-[820px]">
          <div
            className={cx(
              'grid bg-slate-50 px-5 py-3 text-10 font-semibold uppercase tracking-filter text-slate-400',
              issuing ? STOCK_GRID : ISSUED_GRID,
            )}
          >
            {issuing && <span />}
            <span>Позиция</span>
            <span>Инв. номер</span>
            <span>{issuing ? 'Состояние' : 'У кого'}</span>
            <span>{issuing ? 'Примечание' : 'Выдано'}</span>
            {!issuing && <span>Состояние</span>}
          </div>

          {dashboard.isPending ? (
            <TableSkeleton
              columns={issuing ? STOCK_COLUMNS : ISSUED_COLUMNS}
              rows={7}
              label={issuing ? 'Загрузка техники в наличии' : 'Загрузка выданной техники'}
            />
          ) : dashboard.isError ? (
            <ErrorBlock
              message={errorMessage(dashboard.error, 'Не удалось загрузить технику')}
              onRetry={() => void dashboard.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyBlock
              icon={<Laptop className="h-7 w-7" />}
              title={
                filtered
                  ? 'Ничего не найдено'
                  : issuing
                    ? 'Техника ещё не заведена'
                    : 'Никому ничего не выдано'
              }
              description={
                filtered
                  ? 'Измените поиск или фильтр.'
                  : issuing
                    ? 'Добавьте позицию — например «Ноутбук Lenovo ThinkPad» — и её экземпляры.'
                    : undefined
              }
            />
          ) : (
            rows.map(({ item, unit }) => (
              <UnitRow
                key={unit.id}
                item={item}
                unit={unit}
                selectable={issuing}
                selected={selected.includes(unit.id ?? -1)}
                onToggle={() => onToggle(unit.id!)}
                onOpen={() => onOpenUnit(unit.id!)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Summary({
  data,
  state,
}: {
  data?: Schema<'EquipmentDashboardSummary'>;
  state: 'IN_STOCK' | 'ISSUED';
}) {
  return (
    <div className="flex flex-wrap gap-2 text-sm text-slate-600" aria-label="Сводка по отфильтрованной технике">
      <span className="rounded-lg bg-slate-100 px-3 py-1.5">
        Всего: <strong className="text-slate-800">{data?.total ?? 0}</strong>
      </span>
      <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700">
        {state === 'IN_STOCK' ? 'В наличии' : 'Выдано'}:{' '}
        <strong>{state === 'IN_STOCK' ? (data?.inStock ?? 0) : (data?.issued ?? 0)}</strong>
      </span>
      {(data?.withProblem ?? 0) > 0 && (
        <span className="rounded-lg bg-red-50 px-3 py-1.5 text-red-700">
          С проблемой: <strong>{data?.withProblem}</strong>
        </span>
      )}
    </div>
  );
}

function UnitRow({
  item,
  unit,
  selectable,
  selected,
  onToggle,
  onOpen,
}: {
  item: Schema<'EquipmentItemView'>;
  unit: EquipmentUnit;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const problem = equipmentProblemLabel(unit.problem);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cx(
        'grid min-h-14 cursor-pointer items-center border-t border-slate-100 px-5 py-3 text-sm transition hover:bg-slate-50',
        selectable ? STOCK_GRID : ISSUED_GRID,
        selected && 'bg-brand-50/60',
      )}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          // Выдавать можно не всё: «Потеряна» запрещает, и сервер отдаёт это готовым
          // флагом — экран не собирает условие заново.
          disabled={!unit.issuable}
          onChange={onToggle}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Выбрать ${unit.inventoryNumber ?? ''}`}
          className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400 disabled:opacity-40"
        />
      )}
      <div className="min-w-0 pr-5">
        <p className="truncate font-medium text-slate-800">{item.name ?? unit.itemName ?? '—'}</p>
        {unit.serialNumber && (
          <p className="truncate text-xs text-slate-400">SN {unit.serialNumber}</p>
        )}
      </div>
      <span className="font-semibold text-slate-700">{unit.inventoryNumber ?? '—'}</span>
      {selectable ? (
        <>
          <div className="min-w-0 pr-4">
            {problem ? (
              <Badge tone="red" dot>
                {problem}
              </Badge>
            ) : (
              <Badge tone="green" dot>
                В наличии
              </Badge>
            )}
          </div>
          <span className="truncate text-slate-500">{unit.note || '—'}</span>
        </>
      ) : (
        <>
          <div className="min-w-0 pr-4">
            <p className="truncate text-slate-700">{unit.holder?.fullName ?? '—'}</p>
            {unit.holder?.active === false && (
              <p className="text-xs text-slate-400">Сотрудник неактивен</p>
            )}
          </div>
          <span className="truncate text-slate-500">{formatDateTime(unit.issuedAt)}</span>
          <div className="min-w-0">
            {problem ? (
              <Badge tone="red" dot>
                {problem}
              </Badge>
            ) : (
              <Badge tone="blue" dot>
                Выдано
              </Badge>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function HistoryPanel({
  page,
  action,
  itemFilter,
  items,
  onActionChange,
  onItemChange,
  onPageChange,
}: {
  page: number;
  action: string;
  itemFilter: string;
  items: Schema<'EquipmentItemOptionView'>[];
  onActionChange: (value: string) => void;
  onItemChange: (value: string) => void;
  onPageChange: (page: number) => void;
}) {
  const filters = useMemo(
    () => ({
      page,
      size: HISTORY_PAGE_SIZE,
      action: action === 'all' ? undefined : action,
      itemId: itemFilter === 'all' ? undefined : Number(itemFilter),
    }),
    [page, action, itemFilter],
  );
  const history = useEquipmentHistory(filters);
  const rows = history.data?.content ?? [];
  const groups = useMemo(() => collapseEquipmentEvents(rows), [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-end gap-3">
        <FilterSelect label="Позиция" value={itemFilter} onChange={onItemChange} className="w-56">
          <option value="all">Все позиции</option>
          {items.map((item) => (
            <option key={item.id} value={String(item.id)}>
              {item.name ?? ''}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Событие" value={action} onChange={onActionChange} className="w-60">
          <option value="all">Все события</option>
          <option value="ISSUED">Выдача</option>
          <option value="RETURNED">Возврат</option>
          <option value="TRANSFERRED">Передача</option>
          <option value="PROBLEM_SET">Отметка проблемы</option>
          <option value="PROBLEM_CHANGED">Изменение проблемы</option>
          <option value="PROBLEM_CLEARED">Снятие проблемы</option>
          <option value="UNIT_CREATED">Принято на учёт</option>
          <option value="UNIT_UPDATED">Изменение номеров</option>
          <option value="ITEM_RENAMED">Переименование позиции</option>
          <option value="WRITTEN_OFF">Списание</option>
        </FilterSelect>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <div className="min-w-[980px]">
          <div
            className={cx(
              'grid bg-slate-50 px-5 py-3 text-10 font-semibold uppercase tracking-filter text-slate-400',
              HISTORY_GRID,
            )}
          >
            <span>Дата</span>
            <span>Позиция</span>
            <span>Экземпляр</span>
            <span>Действие</span>
            <span>Сотрудник</span>
            <span>Кто выполнил</span>
          </div>

          {history.isPending ? (
            <TableSkeleton columns={HISTORY_COLUMNS} rows={8} label="Загрузка истории" />
          ) : history.isError ? (
            <ErrorBlock
              message={errorMessage(history.error, 'Не удалось загрузить историю')}
              onRetry={() => void history.refetch()}
            />
          ) : groups.length === 0 ? (
            <EmptyBlock
              icon={<History className="h-7 w-7" />}
              title="История пока пуста"
              description={
                action !== 'all' || itemFilter !== 'all'
                  ? 'Для выбранного отбора записей нет.'
                  : undefined
              }
            />
          ) : (
            groups.map((group) => <HistoryRow key={group.key} group={group} />)
          )}
        </div>
      </div>

      {!history.isError && (history.data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Показано {page * HISTORY_PAGE_SIZE + 1}–
            {Math.min((page + 1) * HISTORY_PAGE_SIZE, history.data?.totalElements ?? 0)} из{' '}
            {history.data?.totalElements ?? 0}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronLeft className="h-4 w-4" />}
              disabled={history.isFetching || history.data?.first}
              onClick={() => onPageChange(Math.max(0, page - 1))}
            >
              Назад
            </Button>
            <span className="min-w-24 text-center">
              {page + 1} из {history.data?.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronRight className="h-4 w-4" />}
              disabled={history.isFetching || history.data?.last}
              onClick={() => onPageChange(page + 1)}
            >
              Далее
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ group }: { group: EquipmentEventGroup }) {
  const event = group.first;
  const action = equipmentAction(event.action);
  const rename = eventItemRename(event);
  return (
    <div
      className={cx(
        'grid min-h-14 items-center border-t border-slate-100 px-5 py-3 text-sm',
        HISTORY_GRID,
      )}
    >
      <span className="text-slate-500">{formatDateTime(event.createdAt)}</span>
      <span className="truncate pr-4 font-medium text-slate-800">
        {rename ?? eventItemName(group)}
      </span>
      <span className="font-semibold text-slate-700">{eventUnitLabel(group)}</span>
      <span>
        <Badge tone={action.tone}>{action.label}</Badge>
      </span>
      <span className="truncate pr-4 text-slate-700">{eventEmployee(event)}</span>
      <span className="truncate text-slate-500">
        <UserCog className="mr-1.5 inline h-4 w-4" />
        {event.actor?.fullName ?? 'Система'}
      </span>
    </div>
  );
}
