import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAllServiceRequests } from '@/hooks/queries';
import { cx, formatDateTime } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import {
  ADMIN_PAGE_SIZE,
  EMPTY_REQUESTS_FILTER,
  hasActiveFilters,
  type AllRequestsFilter,
} from '@/lib/serviceRequestsAdminApi';
import { actionErrorText, locationLine, serviceTypeLabel } from '@/lib/serviceRequestsModel';
import type { PickedAccount } from '@/platform/components/AccountPicker';
import { Pager } from './Pager';
import { ServiceRequestFilters } from './ServiceRequestFilters';
import { EmergencyChip, ServiceStatusChip } from './ServiceStatusChip';

/**
 * «Все заявки» — раздел Super Admin (ТЗ SERVICE-FE-004 §5–§8).
 *
 * Только просмотр: ни одной кнопки, меняющей чужую заявку, здесь нет — как нет и
 * эндпоинтов для этого (§10). Из строки открывается та же карточка, что и у автора; она
 * сама прячет авторские действия, когда заявка не своя.
 *
 * Порядок «свежая активность сверху» приходит с сервера (`updatedAt DESC`), поэтому
 * строки не пересортировываются: страница уже отрезана этим порядком, и наводить свой
 * внутри неё значило бы показывать первые двадцать в другом порядке, чем остальные.
 */

/**
 * Ширины заданы всем колонкам, кроме описания: оно забирает остаток, но не уже
 * `min-w`. Без нижней границы описание схлопывалось до «Разлит…» — колонка, которая
 * ничего не сообщает, хуже отсутствующей.
 */
const COLUMNS = [
  { key: 'request', label: 'Заявка', className: 'w-36' },
  { key: 'location', label: 'Местонахождение', className: 'w-48' },
  { key: 'description', label: 'Краткое описание', className: 'min-w-[220px]' },
  { key: 'author', label: 'Автор', className: 'w-40' },
  { key: 'assignee', label: 'Исполнитель', className: 'w-40' },
  { key: 'type', label: 'Служба', className: 'w-28' },
  { key: 'status', label: 'Статус', className: 'w-44' },
  { key: 'action', label: 'Действие', className: 'w-28 text-right' },
] as const;

const HEAD_CELL = 'px-4 py-3 text-left text-10 font-medium uppercase tracking-wide text-subtle';
const CELL = 'px-4 py-4 align-middle text-13 text-ink';

export function AllServiceRequestsTab() {
  const navigate = useNavigate();

  const [filter, setFilter] = useState<AllRequestsFilter>(EMPTY_REQUESTS_FILTER);
  const [search, setSearch] = useState('');
  // Выбранных людей держим целиком, а не только их идентификаторы: фильтр обязан
  // показывать, кто выбран, а второй запрос за именем ради подписи был бы лишним.
  const [author, setAuthor] = useState<PickedAccount | null>(null);
  const [assignee, setAssignee] = useState<PickedAccount | null>(null);
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebouncedValue(search);
  const applied: AllRequestsFilter = { ...filter, search: debouncedSearch };
  const listQuery = useAllServiceRequests(applied, page);

  function patch(next: Partial<AllRequestsFilter>) {
    setFilter((prev) => ({ ...prev, ...next }));
    // Любая правка фильтра возвращает на первую страницу: иначе после сужения выдачи
    // человек оставался бы на седьмой странице, которой больше нет.
    setPage(0);
  }

  function reset() {
    setFilter(EMPTY_REQUESTS_FILTER);
    setSearch('');
    setAuthor(null);
    setAssignee(null);
    setPage(0);
  }

  const rows = listQuery.data?.content ?? [];
  const total = listQuery.data?.totalElements ?? 0;
  const totalPages = listQuery.data?.totalPages ?? 0;

  return (
    <div className="space-y-5">
      <ServiceRequestFilters
        filter={applied}
        search={search}
        author={author}
        assignee={assignee}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        onChange={patch}
        onAuthorChange={(next) => {
          setAuthor(next);
          patch({ authorId: next?.id ?? null });
        }}
        onAssigneeChange={(next) => {
          setAssignee(next);
          patch({ assigneeId: next?.id ?? null });
        }}
        onReset={reset}
      />

      {listQuery.isPending ? (
        <TableSkeleton />
      ) : listQuery.isError ? (
        <ErrorBlock
          message={actionErrorText(listQuery.error)}
          onRetry={() => void listQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyBlock
            title={hasActiveFilters(applied) ? 'Ничего не найдено' : 'Заявок пока нет'}
            description={
              hasActiveFilters(applied)
                ? 'Измените фильтры или очистите поиск.'
                : 'Здесь появятся все заявки школы — и клининга, и техслужбы.'
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse">
              <thead className="border-b border-line bg-neutral-bg/40">
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column.key} scope="col" className={cx(HEAD_CELL, column.className)}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-line last:border-0 hover:bg-neutral-bg/30"
                  >
                    <td className={CELL}>
                      <span className="block font-semibold text-link">{row.requestNumber}</span>
                      {/* Дата последнего события, а не создания: по ней раздел и
                          отсортирован, и подписывать строку другой датой значило бы
                          объяснять порядок, которого не видно. */}
                      <span className="block text-11 text-subtle">
                        {formatDateTime(row.updatedAt ?? row.createdAt)}
                      </span>
                    </td>

                    <td className={CELL}>{locationLine(row) || '—'}</td>

                    <td className={cx(CELL, 'max-w-0 truncate')} title={row.description}>
                      {row.description}
                    </td>

                    <td className={cx(CELL, 'truncate')}>{row.authorName ?? '—'}</td>
                    <td className={cx(CELL, 'truncate')}>{row.assignedToName ?? 'Не назначен'}</td>

                    <td className={CELL}>
                      <span className="inline-flex items-center rounded bg-neutral-bg px-2 py-1 text-11 font-medium text-ink">
                        {serviceTypeLabel(row.serviceType)}
                      </span>
                    </td>

                    <td className={CELL}>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <ServiceStatusChip status={row.status} />
                        {row.emergency && <EmergencyChip />}
                      </span>
                    </td>

                    <td className={cx(CELL, 'text-right')}>
                      <Button
                        variant="secondary"
                        size="sm"
                        // `?from=all` возвращает из карточки сюда, а не в «Мои заявки».
                        onClick={() => navigate(`${ROUTES.serviceRequest(row.id as number)}?from=all`)}
                      >
                        Открыть
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pager
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={ADMIN_PAGE_SIZE}
            unit={['заявка', 'заявки', 'заявок']}
            onPage={setPage}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Скелет под колонки именно этого раздела.
 *
 * Своим, а не общим со списком автора: у «Всех заявок» восемь колонок вместо семи, и
 * чужой скелет сдвигал бы таблицу в момент, когда приходят данные.
 */
function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full border-collapse">
        <thead className="border-b border-line bg-neutral-bg/40">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className={cx(HEAD_CELL, column.className)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, index) => (
            <tr key={index} className="border-b border-line last:border-0">
              {COLUMNS.map((column) => (
                <td key={column.key} className={CELL}>
                  <span className="block h-4 w-full max-w-32 animate-pulse rounded bg-neutral-bg" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
