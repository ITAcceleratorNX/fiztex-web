import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { Button, buttonClassName } from '@/components/ui/Button';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { SCOPE_STATUSES, homeworkApi, type Homework, type HomeworkScope } from '@/lib/homeworkApi';
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

  const [scope, setScope] = useState<HomeworkScope>('ACTUAL');
  const [filters, setFilters] = useState<HomeworkFilterValues>(EMPTY_FILTERS);

  const listQuery = useQuery({
    queryKey: ['homework', 'list', scope, filters],
    queryFn: ({ signal }) =>
      homeworkApi.list(
        {
          scope,
          statuses: filters.status ? [filters.status] : undefined,
          classId: filters.classId,
          subjectId: filters.subjectId,
          dueFrom: filters.dueFrom ? dayStart(filters.dueFrom) : undefined,
          dueTo: filters.dueTo ? dayEnd(filters.dueTo) : undefined,
          pendingReviewOnly: filters.pendingReviewOnly || undefined,
          size: PAGE_SIZE,
        },
        signal,
      ),
    placeholderData: (previous) => previous,
  });

  /**
   * Переключение вкладки сбрасывает статус, но не остальные фильтры (§4.3): класс и предмет
   * осмысленны на обеих вкладках, а статус чужой вкладки дал бы заведомо пустую выдачу.
   */
  function changeScope(next: HomeworkScope) {
    setScope(next);
    setFilters((current) =>
      current.status && !SCOPE_STATUSES[next].includes(current.status)
        ? { ...current, status: undefined }
        : current,
    );
  }

  const rows = listQuery.data?.content ?? [];
  const filtersActive = hasActiveFilters(filters);
  const { classes: classOptions, subjects: subjectOptions } = useFilterOptions(rows);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-28 font-bold text-ink">Домашние задания</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          value={scope}
          options={TABS}
          onChange={changeScope}
          ariaLabel="Вкладки заданий"
        />
        <HomeworkFilters
          scope={scope}
          values={filters}
          classes={classOptions}
          subjects={subjectOptions}
          onChange={setFilters}
        />
      </div>

      <HomeworkBody
        isPending={listQuery.isPending}
        error={listQuery.error}
        rows={rows}
        scope={scope}
        filtersActive={filtersActive}
        onRetry={() => void listQuery.refetch()}
        onResetFilters={() => setFilters(EMPTY_FILTERS)}
      />

      {rows.length > 0 && (
        <div>
          <Link to="/homework/new" className={buttonClassName({ variant: 'primary' })}>
            Создать задание
          </Link>
        </div>
      )}
    </div>
  );
}

function HomeworkBody({
  isPending,
  error,
  rows,
  scope,
  filtersActive,
  onRetry,
  onResetFilters,
}: {
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
            action={
              <Link to="/homework/new" className={buttonClassName({ variant: 'primary' })}>
                Создать задание
              </Link>
            }
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

  return <HomeworkTable rows={rows} />;
}

/**
 * Варианты фильтров берутся из самих заданий, а не из справочников `/api/admin/*`.
 *
 * Причина не в экономии запроса: админские справочники учителю отдают 401, а общий
 * `request()` трактует любой 401 как истёкшую сессию — раздел выкидывал учителя на форму
 * входа ровно в момент открытия. Заодно это правильнее по смыслу: учителю нужны его
 * классы и предметы (ТЗ §3), а не список всей школы.
 *
 * Набор накапливается между запросами и не сбрасывается выбранным фильтром. Иначе выбор
 * «7А» сузил бы выдачу до одного класса, список вариантов схлопнулся бы до него же, и
 * переключиться на другой класс стало бы нечем — фильтр запирал бы сам себя.
 */
function useFilterOptions(rows: Homework[]): { classes: FilterOption[]; subjects: FilterOption[] } {
  const seen = useRef({ classes: new Map<number, string>(), subjects: new Map<number, string>() });

  for (const row of rows) {
    if (row.classId != null && row.className) seen.current.classes.set(row.classId, row.className);
    if (row.subjectId != null && row.subjectName) {
      seen.current.subjects.set(row.subjectId, row.subjectName);
    }
  }

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
