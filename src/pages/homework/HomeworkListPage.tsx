import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, Plus, Users } from 'lucide-react';
import { Button, buttonClassName } from '@/components/ui/Button';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { useHomeworkList, useHomeworkFilterOptions, useTextbookBindingOptions } from '@/hooks/queries';
import { useHomeworkListScroll } from '@/hooks/useHomeworkListScroll';
import { useListSearchParams } from '@/hooks/useListNavigation';
import { readHomeworkListState, writeHomeworkListState, type HomeworkListState } from '@/lib/homeworkListNavigation';
import type { BindingOptions } from '@/lib/textbooksApi';
import { SCOPE_STATUSES, type Homework, type HomeworkScope } from '@/lib/homeworkApi';
import {
  EMPTY_FILTERS,
  HomeworkFilters,
  hasActiveFilters,
  type FilterOption,
  type HomeworkFilterValues,
} from './HomeworkFilters';
import { HomeworkTable, HomeworkTableSkeleton } from './HomeworkTable';

const TABS = [
  { value: 'ACTUAL', label: 'Актуальные' },
  { value: 'HISTORY', label: 'История' },
] as const satisfies ReadonlyArray<{ value: HomeworkScope; label: string }>;

const PAGE_SIZE = 50;

/**
 * Домашние задания учителя (ТЗ HOMEWORK-005.1, Figma 856:20520 и состояния 20683…20994).
 *
 * Вкладка — это набор статусов, а не отдельная выдача: повторно открытое задание
 * возвращается в «Актуальные» само, потому что у него сменился статус (§4.1, §6).
 *
 * Ни один фильтр не считается на клиенте (§7). Соблазн отобрать пришедшую страницу по
 * «есть работы на проверку» здесь особенно велик — признак лежит в каждой строке, — но
 * страница это лишь срез: отфильтровав её, мы показали бы «ничего не найдено» там, где
 * подходящие задания просто лежат на следующей.
 */
export function HomeworkListPage() {
  useDocumentTitle('Домашние задания');

  const [optionsRequested, setOptionsRequested] = useState(false);
  const [search, setSearch] = useListSearchParams('homework', [
    'scope', 'status', 'classId', 'subjectId', 'dueFrom', 'dueTo', 'pendingReviewOnly', 'page',
  ]);
  const state = useMemo(() => readHomeworkListState(search), [search]);
  const { scope, filters, page } = state;
  const canonicalSearch = writeHomeworkListState(state);
  const url = `/homework${canonicalSearch.size ? `?${canonicalSearch}` : ''}`;
  const filterKey = JSON.stringify({ scope, filters });
  const listQuery = useHomeworkList({
    scope,
    statuses: filters.status ? [filters.status] : undefined,
    classId: filters.classId,
    subjectId: filters.subjectId,
    dueFrom: filters.dueFrom ? dayStart(filters.dueFrom) : undefined,
    dueTo: filters.dueTo ? dayEnd(filters.dueTo) : undefined,
    pendingReviewOnly: filters.pendingReviewOnly || undefined,
    page,
    size: PAGE_SIZE,
  });
  // TanStack убирает placeholderData при ошибке следующей страницы. Сохраняем
  // последнюю успешную выдачу только для того же набора фильтров.
  const previous = useRef<{ key: string; data: NonNullable<typeof listQuery.data> }>();
  if (listQuery.data) previous.current = { key: filterKey, data: listQuery.data };
  const denied = listQuery.error instanceof ApiError && listQuery.error.status === 403;
  const data = denied ? undefined : listQuery.data
    ?? (previous.current?.key === filterKey ? previous.current.data : undefined);
  const shownPage = data?.number ?? page;
  const totalPages = data?.totalPages ?? 0;
  const root = useHomeworkListScroll(url, Boolean(listQuery.data));
  const optionsQuery = useTextbookBindingOptions(Boolean(data));
  const historicalOptions = useHomeworkFilterOptions(optionsRequested && Boolean(data));
  const rows = data?.content ?? [];
  const filtersActive = hasActiveFilters(filters);
  const { classes: classOptions, subjects: subjectOptions } = useFilterOptions(rows, optionsQuery.data, filters, historicalOptions.data);
  const createParams = new URLSearchParams();
  if (filters.classId != null) createParams.set('classId', String(filters.classId));
  if (filters.subjectId != null) createParams.set('subjectId', String(filters.subjectId));
  const createUrl = `/homework/new${createParams.size ? `?${createParams}` : ''}`;

  function change(next: HomeworkListState, replace = false) {
    setSearch(writeHomeworkListState(next), { replace });
  }
  function changeFilters(next: HomeworkFilterValues) {
    change({ scope, filters: next, page: 0 });
  }
  function changeScope(next: HomeworkScope) {
    change({ scope: next, page: 0, filters: {
      ...filters,
      status: filters.status && SCOPE_STATUSES[next].includes(filters.status) ? filters.status : undefined,
    } });
  }

  // Удаление последнего задания могло сократить число страниц; старый URL не тупик.
  useEffect(() => {
    if (listQuery.isSuccess && listQuery.data && page > Math.max(0, (listQuery.data.totalPages ?? 0) - 1)) {
      setSearch(writeHomeworkListState({ ...state, page: Math.max(0, (listQuery.data.totalPages ?? 0) - 1) }), { replace: true });
    }
  }, [listQuery.isSuccess, listQuery.data, page, state, setSearch]);
  const shownSearch = writeHomeworkListState({ ...state, page: shownPage });
  const shownUrl = `/homework${shownSearch.size ? `?${shownSearch}` : ''}`;

  return (
    <div ref={root} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 text-28 font-bold text-ink">Домашние задания</h1>
        {!denied && (
          <Link to={createUrl} className={buttonClassName({ variant: 'primary', className: 'shrink-0' })}>
            <Plus className="size-4" aria-hidden />
            Создать задание
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          value={scope}
          options={TABS}
          onChange={changeScope}
          ariaLabel="Вкладки заданий"
        />
        <div className="flex flex-wrap items-center gap-2">
          <HomeworkFilters
            scope={scope}
            values={filters}
            classes={classOptions}
            subjects={subjectOptions}
            onChange={changeFilters}
            onOpenOptions={() => setOptionsRequested(true)}
          />
          <GroupsButton classId={filters.classId} subjectId={filters.subjectId} />
        </div>
      </div>

      {optionsQuery.isPending && data && <p role="status" className="text-13 text-muted">Загрузка классов и предметов…</p>}
      {historicalOptions.isFetching && <p role="status" className="text-13 text-muted">Загрузка классов и предметов из истории заданий…</p>}
      {historicalOptions.isError && (
        <div className="card">
          <ErrorBlock message="Не удалось загрузить варианты из истории заданий. Доступные варианты сохранены"
            onRetry={() => void historicalOptions.refetch()} />
        </div>
      )}
      {optionsQuery.isError && (
        <div className="card">
          <ErrorBlock message="Не удалось загрузить полный список классов и предметов" onRetry={() => void optionsQuery.refetch()} />
        </div>
      )}
      {listQuery.isFetching && data && <p role="status" className="text-13 text-muted">Загрузка страницы {page + 1}…</p>}
      {listQuery.error && data && (
        <div className="card">
          <ErrorBlock
            message={`Не удалось загрузить страницу ${page + 1}. Показана страница ${shownPage + 1}`}
            onRetry={() => void listQuery.refetch()}
          />
        </div>
      )}
      <HomeworkBody
        listUrl={shownUrl}
        isPending={listQuery.isPending && !data}
        error={data ? null : listQuery.error}
        rows={rows}
        scope={scope}
        filtersActive={filtersActive}
        onRetry={() => void listQuery.refetch()}
        onResetFilters={() => changeFilters(EMPTY_FILTERS)}
      />

      {data && totalPages > 1 && (
        <nav aria-label="Страницы домашних заданий" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-13 text-muted" aria-live="polite">
            Страница {shownPage + 1} из {totalPages} · Всего заданий: {data.totalElements}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={listQuery.isFetching || shownPage === 0}
              onClick={() => change({ ...state, page: shownPage - 1 })}>Предыдущая страница</Button>
            <Button variant="secondary" size="sm" disabled={listQuery.isFetching || data.last === true || shownPage + 1 >= totalPages}
              onClick={() => shownPage + 1 === page && listQuery.isError
                ? void listQuery.refetch() : change({ ...state, page: shownPage + 1 })}>Следующая страница</Button>
          </div>
        </nav>
      )}

    </div>
  );
}

/**
 * Вход в деление класса на временные группы (HOMEWORK-002 §5).
 *
 * Стоит рядом с фильтрами не ради симметрии: группы заводятся под пару «класс + предмет»,
 * и ровно эта пара уже выбрана здесь же фильтрами — другого места, где она задана до
 * открытия задания, на экране нет.
 *
 * Пока пара не выбрана, кнопка неактивна и говорит почему: увести человека на экран,
 * который встретит его сообщением «не указан класс», — хуже, чем не пустить сразу.
 */
function GroupsButton({ classId, subjectId }: { classId?: number; subjectId?: number }) {
  const ready = classId != null && subjectId != null;

  if (!ready) {
    return (
      <span
        title="Выберите класс и предмет — группы заводятся для этой пары"
        className={buttonClassName({ variant: 'secondary', size: 'sm', className: 'cursor-not-allowed opacity-50' })}
        aria-disabled
      >
        <Users className="size-4" aria-hidden />
        Группы
      </span>
    );
  }

  return (
    <Link
      to={`/homework/groups?classId=${classId}&subjectId=${subjectId}`}
      className={buttonClassName({ variant: 'secondary', size: 'sm' })}
    >
      <Users className="size-4" aria-hidden />
      Группы
    </Link>
  );
}

function HomeworkBody({
  listUrl,
  isPending,
  error,
  rows,
  scope,
  filtersActive,
  onRetry,
  onResetFilters,
}: {
  listUrl: string;
  isPending: boolean;
  error: unknown;
  rows: Parameters<typeof HomeworkTable>[0]['rows'];
  scope: HomeworkScope;
  filtersActive: boolean;
  onRetry: () => void;
  onResetFilters: () => void;
}) {
  if (isPending) return <HomeworkTableSkeleton />;

  if (error) {
    // 403 — не сбой загрузки: у аккаунта нет учительского доступа к разделу (§8).
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="card">
          <EmptyBlock
            icon={<Info className="size-7" />}
            title="Раздел недоступен"
            description="Домашними заданиями управляет учитель. Если доступ нужен, обратитесь к администратору."
          />
        </div>
      );
    }
    return (
      <div className="card">
        <ErrorBlock
          message={
            error instanceof ApiError && error.status === 0
              ? 'Не удалось загрузить задания. Проверьте подключение к сети и попробуйте ещё раз'
              : 'Не удалось загрузить задания. Попробуйте ещё раз'
          }
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (rows.length === 0) {
    // Пустой фильтр и пустая вкладка — разные состояния: в первом случае помогает сброс,
    // во втором сбрасывать нечего (§8).
    if (filtersActive) {
      return (
        <div className="card">
          <EmptyBlock
            icon={<Info className="size-7" />}
            title="Ничего не найдено"
            description="Под выбранные фильтры не подходит ни одно задание"
            action={
              <Button variant="secondary" size="sm" onClick={onResetFilters}>
                Сбросить фильтры
              </Button>
            }
          />
        </div>
      );
    }
    return (
      <div className="card">
        {scope === 'ACTUAL' ? (
          <EmptyBlock
            icon={<Info className="size-7" />}
            title="Нет актуальных заданий"
            description="Создайте первое задание — ученики увидят его сразу после публикации"
          />
        ) : (
          <EmptyBlock
            icon={<Info className="size-7" />}
            title="В истории пока ничего нет"
            description="Завершённые и отменённые задания будут отображаться здесь"
          />
        )}
      </div>
    );
  }

  return <HomeworkTable rows={rows} returnTo={listUrl} />;
}

/** Контекст назначений не зависит от страницы ДЗ. Просмотренные задания дополняют
 * его историческими классами; выбранный ID из ссылки остаётся видимым и до загрузки. */
function useFilterOptions(rows: Homework[], context: BindingOptions | undefined, filters: HomeworkFilterValues, historical?: { classes: FilterOption[]; subjects: FilterOption[] }): { classes: FilterOption[]; subjects: FilterOption[] } {
  const seen = useRef({ classes: new Map<number, string>(), subjects: new Map<number, string>() });
  for (const row of [...(context?.years ?? []).flatMap((year) => year.assignments ?? []), ...rows]) {
    if (row.classId != null && row.className) seen.current.classes.set(row.classId, row.className);
    if (row.subjectId != null && row.subjectName) seen.current.subjects.set(row.subjectId, row.subjectName);
  }
  for (const item of historical?.classes ?? []) seen.current.classes.set(item.id, item.name);
  for (const item of historical?.subjects ?? []) seen.current.subjects.set(item.id, item.name);
  if (filters.classId != null && !seen.current.classes.has(filters.classId)) seen.current.classes.set(filters.classId, `Класс №${filters.classId}`);
  if (filters.subjectId != null && !seen.current.subjects.has(filters.subjectId)) seen.current.subjects.set(filters.subjectId, `Предмет №${filters.subjectId}`);

  const sort = (map: Map<number, string>): FilterOption[] =>
    [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true }));

  return { classes: sort(seen.current.classes), subjects: sort(seen.current.subjects) };
}

/**
 * Дата из фильтра — это местный день, а срок хранится моментом времени. Поэтому границы
 * периода растягиваются на весь день: иначе «по 20 октября» отсекло бы задание со сроком
 * в 18:00 того же числа.
 */
function dayStart(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

function dayEnd(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}
