import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import type { AccessRequestRole, AccessRequestStage } from '@/lib/accessRequestsApi';
import { useAccessRequests } from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Field';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { SearchInput } from '@/components/ui/SearchInput';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatShortDayMonthTime } from '@/lib/format';
import { REQUEST_TABS, isRequestStage, phoneLabel, roleLabel, rowClassLabel } from './accessRequestModel';

const PAGE_SIZE = 25;
const COLUMNS = ['w-24', 'flex-1', 'w-36', 'w-44', 'w-52', 'w-44'];

const EMPTY_BY_STAGE: Record<AccessRequestStage, { title: string; description: string }> = {
  PENDING: { title: 'Новых заявок нет', description: 'Все заявки рассмотрены. Новые появятся здесь и в меню.' },
  APPROVED_PENDING_ACTIVATION: { title: 'Нет одобренных заявок', description: 'Здесь будут те, кому доступ открыли, но кто ещё не вошёл.' },
  ACTIVE: { title: 'Никто ещё не подключился', description: 'Сюда попадают заявители, которые уже вошли в приложение.' },
  REJECTED: { title: 'Отклонённых заявок нет', description: 'Отклонённые заявки остаются здесь вместе с причиной.' },
  DRAFT: { title: 'Черновиков нет', description: 'Незаконченные заявки видит только сам заявитель.' },
};

export function AccessRequestsPanel() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const stageParam = params.get('stage');
  const stage: AccessRequestStage = isRequestStage(stageParam) ? stageParam : 'PENDING';
  const roleParam = params.get('role');
  const role: AccessRequestRole | 'all' = roleParam === 'STUDENT' || roleParam === 'PARENT' ? roleParam : 'all';
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);
  const [query, setQuery] = useState(params.get('q') ?? '');
  const rootRef = useRef<HTMLDivElement>(null);
  const settledQuery = useDebouncedValue(query.trim());

  useEffect(() => {
    setParams((current) => {
      if ((current.get('q') ?? '') === settledQuery) return current;
      const next = new URLSearchParams(current);
      if (settledQuery) next.set('q', settledQuery);
      else next.delete('q');
      next.delete('page');
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

  const requests = useAccessRequests({
    stage,
    role: role === 'all' ? undefined : role,
    query: settledQuery || undefined,
    page,
    size: PAGE_SIZE,
  });

  const rows = requests.data?.content ?? [];
  const totalPages = requests.data?.totalPages ?? 0;
  const empty = EMPTY_BY_STAGE[stage];

  return (
    <div ref={rootRef} className="flex scroll-mt-6 flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          className="flex-1"
          value={query}
          onChange={setQuery}
          placeholder="ФИО, телефон или номер заявки"
        />
        <div className="lg:w-filter-select">
          <Select
            aria-label="Роль"
            className="h-11"
            value={role}
            onChange={(event) => patchParams({ role: event.target.value === 'all' ? null : event.target.value, page: null })}
          >
            <option value="all">Все роли</option>
            <option value="STUDENT">Ученик</option>
            <option value="PARENT">Родитель</option>
          </Select>
        </div>
        <SegmentedTabs
          appearance="outlined"
          ariaLabel="Этап заявки"
          value={stage}
          options={REQUEST_TABS.map((tab) => ({ value: tab.stage, label: tab.label }))}
          onChange={(next) => patchParams({ stage: next === 'PENDING' ? null : next, page: null })}
        />
      </div>

      {requests.isPending && <TableSkeleton columns={COLUMNS} rows={6} />}
      {requests.isError && (
        <ErrorBlock
          message={requests.error instanceof ApiError ? requests.error.message : 'Не удалось загрузить заявки. Попробуйте ещё раз.'}
          onRetry={() => void requests.refetch()}
        />
      )}
      {!requests.isPending && !requests.isError && rows.length === 0 && (
        <div className="card">
          <EmptyBlock title={empty.title} description={empty.description} />
        </div>
      )}

      {rows.length > 0 && (
        <div
          aria-busy={requests.isPlaceholderData}
          className={requests.isPlaceholderData ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'}
        >
        <DataTable label="Заявки на доступ" appearance="registry">
          <thead>
            <tr>
              <th scope="col" className="w-24">№</th>
              <th scope="col">ФИО</th>
              <th scope="col" className="w-36">Роль</th>
              <th scope="col" className="w-44">Класс</th>
              <th scope="col" className="w-52">Телефон</th>
              <th scope="col" className="w-44">Дата заявки</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.requestId}
                className="cursor-pointer transition-colors hover:bg-planning-canvas"
                onClick={() => navigate(`/admin/access-codes/requests/${row.requestId}`)}
              >
                <td className="text-planning-muted">{row.requestId}</td>
                <td>
                  <Link
                    to={`/admin/access-codes/requests/${row.requestId}`}
                    className="font-semibold text-planning-ink hover:text-navy-700"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {row.fullName}
                  </Link>
                  {row.repeat && (
                    <div className="text-13 leading-4 text-amber-700">Повторная заявка</div>
                  )}
                </td>
                <td>{roleLabel(row.role)}</td>
                <td>{rowClassLabel(row)}</td>
                <td className={row.phone ? undefined : 'text-planning-subtle'}>{phoneLabel(row.phone)}</td>
                <td className="text-planning-muted">{formatShortDayMonthTime(row.submittedAt ?? row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        </div>
      )}

      {requests.data && !requests.isError && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalElements={requests.data.totalElements ?? 0}
          pageSize={PAGE_SIZE}
          itemForms={['заявки', 'заявок', 'заявок']}
          label="Страницы заявок"
          onPageChange={(next) => {
            patchParams({ page: next > 0 ? String(next) : null });
            rootRef.current?.scrollIntoView?.({ block: 'nearest' });
          }}
        />
      )}
    </div>
  );
}
