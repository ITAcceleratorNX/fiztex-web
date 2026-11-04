import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import type { AccessRequestRole, AccessRequestStage } from '@/lib/accessRequestsApi';
import { useAccessRequests } from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Button } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { SearchInput } from '@/components/ui/SearchInput';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatDateTime } from '@/lib/format';
import { REQUEST_TABS, isRequestStage, phoneLabel, roleLabel, rowClassLabel } from './accessRequestModel';

const PAGE_SIZE = 25;
const COLUMNS = ['w-20', 'flex-1', 'w-28', 'w-36', 'w-44', 'w-40'];

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
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-slate-500">
        Ученики и родители, которые отправили заявку из приложения.
      </p>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <SearchInput
          className="flex-1"
          value={query}
          onChange={setQuery}
          placeholder="ФИО, телефон или номер заявки"
        />
        <FilterSelect
          className="lg:w-44"
          label="Роль"
          value={role}
          onChange={(value) => patchParams({ role: value === 'all' ? null : value, page: null })}
        >
          <option value="all">Все роли</option>
          <option value="STUDENT">Ученик</option>
          <option value="PARENT">Родитель</option>
        </FilterSelect>
        <div className="flex flex-wrap gap-1.5">
          {REQUEST_TABS.map((tab) => (
            <Button
              key={tab.stage}
              size="sm"
              variant={tab.stage === stage ? 'navy' : 'ghost'}
              aria-pressed={tab.stage === stage}
              onClick={() => patchParams({ stage: tab.stage === 'PENDING' ? null : tab.stage, page: null })}
            >
              {tab.label}
            </Button>
          ))}
        </div>
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
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-10 uppercase tracking-filter text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">№</th>
                <th className="px-4 py-3 font-semibold">ФИО</th>
                <th className="px-4 py-3 font-semibold">Роль</th>
                <th className="px-4 py-3 font-semibold">Класс</th>
                <th className="px-4 py-3 font-semibold">Телефон</th>
                <th className="px-4 py-3 font-semibold">Дата заявки</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.requestId}
                  className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  onClick={() => navigate(`/admin/access-codes/requests/${row.requestId}`)}
                >
                  <td className="px-4 py-3 text-slate-500">{row.requestId}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/access-codes/requests/${row.requestId}`}
                      className="font-medium text-slate-900 hover:text-navy-700"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {row.fullName}
                    </Link>
                    {row.repeat && (
                      <div className="text-11 font-medium text-brand-600">Повторная заявка</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{roleLabel(row.role)}</td>
                  <td className="px-4 py-3 text-slate-600">{rowClassLabel(row)}</td>
                  <td className={row.phone ? 'px-4 py-3 text-slate-600' : 'px-4 py-3 text-slate-400'}>
                    {phoneLabel(row.phone)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDateTime(row.submittedAt ?? row.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-13 text-slate-500">
            Страница {page + 1} из {totalPages}
          </span>
          <Button
            size="icon-sm"
            variant="secondary"
            aria-label="Предыдущая страница"
            disabled={page === 0}
            onClick={() => patchParams({ page: page > 1 ? String(page - 1) : null })}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            aria-label="Следующая страница"
            disabled={page + 1 >= totalPages}
            onClick={() => patchParams({ page: String(page + 1) })}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
