import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ListChecks } from 'lucide-react';
import { useSurveyStatusTotals, useSurveys } from '@/hooks/surveyQueries';
import { StatCard } from '@/components/ui/StatCard';
import { Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { SurveyStatusBadge } from '@/components/ui/SurveyStatusBadge';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { SurveyCreateModal } from '@/pages/modals/SurveyCreateModal';
import { ROUTES } from '@/lib/routes';
import { ApiError } from '@/lib/api';
import type { SurveyStatus } from '@/lib/surveyApi';
import { SURVEY_VARIANT_COPY, type SurveyVariant } from '@/lib/surveyModel';
import { surveyCardPath } from '@/lib/surveyListNavigation';

const PAGE_SIZE = 20;
const STATUSES: SurveyStatus[] = ['DRAFT', 'ACTIVE', 'COMPLETED'];

function pageFrom(raw: string | null): number {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return 0;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value - 1 : 0;
}

/**
 * Список опросов (Опросы, Phase 2). Сервер применяет фильтр статуса и пагинацию;
 * сводка сверху показывает точные totals по разным статусам, а таблица — текущую страницу.
 */
export function SurveysPage({ variant = 'school' }: { variant?: SurveyVariant }) {
  const copy = SURVEY_VARIANT_COPY[variant];
  // Психолог открывает тест своим адресом: школьные /surveys ему закрыты (routes.ts).
  const cardRoute = (id: number) => (variant === 'psychology' ? ROUTES.psychologistTest(id) : ROUTES.survey(id));
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const rawStatus = search.get('status') as SurveyStatus | null;
  const statusFilter: 'ALL' | SurveyStatus = rawStatus && STATUSES.includes(rawStatus) ? rawStatus : 'ALL';
  const page = pageFrom(search.get('page'));
  const surveys = useSurveys(statusFilter === 'ALL' ? undefined : statusFilter, page, PAGE_SIZE);
  const statusTotals = useSurveyStatusTotals();
  const [createOpen, setCreateOpen] = useState(false);

  const allRows = surveys.data?.content ?? [];
  const rows = allRows;
  const total = surveys.data?.totalElements;
  const totalPages = surveys.data?.totalPages ?? 0;
  const totalsReady = statusTotals.every((query) => query.isSuccess);
  const activeTotal = statusTotals[0]?.data?.totalElements;
  const draftTotal = statusTotals[1]?.data?.totalElements;
  const totalAll = statusTotals.reduce((sum, query) => sum + (query.data?.totalElements ?? 0), 0);

  function setFilters(nextStatus: 'ALL' | SurveyStatus, nextPage = 0) {
    const params = new URLSearchParams(search);
    if (nextStatus === 'ALL') params.delete('status');
    else params.set('status', nextStatus);
    if (nextPage === 0) params.delete('page');
    else params.set('page', String(nextPage + 1));
    setSearch(params);
  }

  const listPath = `${variant === 'psychology' ? '/psychologist/tests' : '/surveys'}${search.size ? `?${search}` : ''}`;

  useEffect(() => {
    if (surveys.isSuccess && totalPages > 0 && page >= totalPages) setFilters(statusFilter, totalPages - 1);
    else if (surveys.isSuccess && totalPages === 0 && page > 0) setFilters(statusFilter, 0);
  }, [surveys.isSuccess, totalPages, page, statusFilter]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
            {copy.listTitle}
          </h1>
          <p className="mt-1 max-w-2xl text-slate-500">{copy.listDescription}</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          {copy.createLabel}
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Всего" value={totalsReady ? totalAll : '—'} />
        <StatCard label="Активных" value={totalsReady ? activeTotal ?? '—' : '—'} />
        <StatCard label="Черновиков" value={totalsReady ? draftTotal ?? '—' : '—'} />
      </div>

      <div className="mb-4 mt-6 flex items-center gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setFilters(e.target.value as 'ALL' | SurveyStatus)}
          className="h-11 w-auto"
        >
          <option value="ALL">Статус: Все</option>
          <option value="DRAFT">Черновик</option>
          <option value="ACTIVE">Активен</option>
          <option value="COMPLETED">Завершён</option>
        </Select>
      </div>

      <div className="card overflow-hidden">
        {surveys.isLoading ? (
          <LoadingBlock label="Загрузка опросов…" />
        ) : surveys.isError ? (
          <ErrorBlock
            message={
              surveys.error instanceof ApiError ? surveys.error.message : 'Не удалось загрузить опросы'
            }
            onRetry={() => void surveys.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyBlock
            icon={<ListChecks className="h-7 w-7" />}
            title={statusFilter === 'ALL' ? copy.emptyTitle : 'Ничего не найдено'}
            description={statusFilter === 'ALL' ? copy.emptyDescription : 'Измените фильтр по статусу.'}
            action={
              statusFilter === 'ALL' ? (
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                  {copy.createLabel}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3.5">Название</th>
                  <th className="px-6 py-3.5">Режим</th>
                  <th className="px-6 py-3.5">Ответили</th>
                  <th className="px-6 py-3.5">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(surveyCardPath(listPath, cardRoute(row.id as number)))}
                    className="cursor-pointer transition hover:bg-slate-50/70"
                  >
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{row.title}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">
                      {row.mode === 'ANONYMOUS' ? 'Анонимный' : 'Именной'}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">
                      {row.respondedCount ?? 0} / {row.recipientsTotal ?? 0}
                    </td>
                    <td className="px-6 py-3.5">
                      <SurveyStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!surveys.isLoading && !surveys.isError && total != null && total > 0 && (
        <nav aria-label="Страницы опросов" className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500" aria-live="polite">
            Страница {page + 1} из {totalPages} · Всего по фильтру: {total}
          </p>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={surveys.isFetching || page === 0}
                onClick={() => setFilters(statusFilter, page - 1)}>Предыдущая страница</Button>
              <Button variant="secondary" size="sm" disabled={surveys.isFetching || surveys.data?.last === true || page + 1 >= totalPages}
                onClick={() => setFilters(statusFilter, page + 1)}>Следующая страница</Button>
            </div>
          )}
        </nav>
      )}

      <SurveyCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => navigate(cardRoute(id))}
        variant={variant}
      />
    </div>
  );
}
