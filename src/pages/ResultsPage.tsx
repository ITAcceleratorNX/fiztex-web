import { useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, FileSearch } from 'lucide-react';
import { useResultsPage } from '@/hooks/queries';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { formatDateTime, pluralRu } from '@/lib/format';
import { ApiError } from '@/lib/api';
import type { ResultListItem, ResultStatus } from '@/lib/types';

type ResultsStatusFilter = 'PENDING' | 'REVIEWED' | 'ALL';

const STATUS_OPTIONS: Array<{ value: ResultsStatusFilter; label: string }> = [
  { value: 'PENDING', label: 'Ожидают ревью' },
  { value: 'REVIEWED', label: 'Проверенные' },
  { value: 'ALL', label: 'Все результаты' },
];

const PAGE_SIZE = 20;
const SKELETON_ROWS = 6;

function parseStatus(value: string | null): ResultsStatusFilter {
  if (value === 'REVIEWED' || value === 'ALL') return value;
  return 'PENDING';
}

function parsePage(value: string | null): number {
  const page = Number(value ?? '0');
  return Number.isFinite(page) && page >= 0 ? page : 0;
}

function statusBadge(status: ResultStatus) {
  if (status === 'PENDING') return <Badge tone="amber" dot>Ожидает проверки</Badge>;
  if (status === 'REVIEWED') return <Badge tone="blue" dot>Проверено</Badge>;
  return <Badge tone="green" dot>Результат открыт</Badge>;
}

function ResultsTableSkeleton() {
  return (
    <tbody className="divide-y divide-slate-50">
      {Array.from({ length: SKELETON_ROWS }).map((_, rowIdx) => (
        <tr key={rowIdx} className="animate-pulse" aria-hidden>
          <td className="px-6 py-3.5">
            <div className="h-4 w-40 rounded bg-slate-100" />
          </td>
          <td className="px-6 py-3.5">
            <div className="h-4 w-32 rounded bg-slate-100" />
          </td>
          <td className="px-6 py-3.5">
            <div className="h-6 w-28 rounded-full bg-slate-100" />
          </td>
          <td className="px-6 py-3.5">
            <div className="h-4 w-16 rounded bg-slate-100" />
          </td>
          <td className="px-6 py-3.5">
            <div className="h-4 w-10 rounded bg-slate-100" />
          </td>
          <td className="px-6 py-3.5">
            <div className="h-4 w-28 rounded bg-slate-100" />
          </td>
          <td className="px-6 py-3.5">
            <div className="ml-auto h-9 w-28 rounded-xl bg-slate-100" />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

export function ResultsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  const status = parseStatus(searchParams.get('status'));
  const search = searchParams.get('search') ?? '';
  const page = parsePage(searchParams.get('page'));

  const results = useResultsPage(status, search, page, PAGE_SIZE);
  const rows = results.data?.content ?? [];
  const totalElements = results.data?.totalElements ?? 0;
  const totalPages = results.data?.totalPages ?? 0;

  function patchParams(next: { status?: ResultsStatusFilter; search?: string; page?: number }) {
    const mergedStatus = next.status ?? status;
    const mergedSearch = next.search ?? search;
    const mergedPage = next.page ?? page;
    const params = new URLSearchParams();
    if (mergedStatus !== 'PENDING') params.set('status', mergedStatus);
    if (mergedSearch.trim()) params.set('search', mergedSearch.trim());
    if (mergedPage > 0) params.set('page', String(mergedPage));
    setSearchParams(params, { replace: true });
  }

  const detailQuery = searchParams.toString();

  function openDetail(attemptId: number) {
    navigate(`/results/attempts/${attemptId}${detailQuery ? `?${detailQuery}` : ''}`);
  }

  function handleRowKeyDown(
    e: React.KeyboardEvent<HTMLTableRowElement>,
    rowIdx: number,
    attemptId: number,
  ) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      rowRefs.current[rowIdx + 1]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      rowRefs.current[rowIdx - 1]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openDetail(attemptId);
    }
  }

  return (
    <div>
      <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
        Результаты
      </h1>
      <p className="mt-1 max-w-2xl text-slate-500">
        Отдельный раздел для проверки, подтверждения и открытия результатов вступительных тестов.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(value) => patchParams({ search: value, page: 0 })}
          placeholder="Поиск по ФИО…"
          className="w-full max-w-xs"
        />
        <Select
          value={status}
          onChange={(e) => patchParams({ status: e.target.value as ResultsStatusFilter, page: 0 })}
          className="h-11 w-auto"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-6 card overflow-hidden">
        {results.isError ? (
          <ErrorBlock
            message={results.error instanceof ApiError ? results.error.message : 'Ошибка загрузки'}
            onRetry={results.refetch}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3.5">Поступающий</th>
                  <th className="px-6 py-3.5">Тест</th>
                  <th className="px-6 py-3.5">Статус</th>
                  <th className="px-6 py-3.5">Балл</th>
                  <th className="px-6 py-3.5">Порог</th>
                  <th className="px-6 py-3.5">Завершение</th>
                  <th className="px-6 py-3.5 text-right">Действия</th>
                </tr>
              </thead>
              {results.isLoading ? (
                <ResultsTableSkeleton />
              ) : rows.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={7}>
                      <EmptyBlock
                        icon={<FileSearch className="h-7 w-7" />}
                        title="Результатов пока нет"
                        description="Измените фильтры или дождитесь завершения и проверки вступительных тестов."
                      />
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row: ResultListItem, rowIdx) => (
                    <tr
                      key={row.attemptId}
                      ref={(el) => {
                        rowRefs.current[rowIdx] = el;
                      }}
                      tabIndex={0}
                      onKeyDown={(e) => handleRowKeyDown(e, rowIdx, row.attemptId)}
                      className="transition focus:outline-none focus-visible:bg-brand-50/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-300"
                    >
                      <td className="px-6 py-3.5 font-semibold text-slate-800">{row.applicantName}</td>
                      <td className="px-6 py-3.5 text-sm text-slate-600">{row.testTitle}</td>
                      <td className="px-6 py-3.5">{statusBadge(row.status)}</td>
                      <td className="px-6 py-3.5 text-sm text-slate-600">
                        {row.totalScore} / {row.maxScore}
                      </td>
                      <td className="px-6 py-3.5 text-sm text-slate-500">{row.minScore}</td>
                      <td className="px-6 py-3.5 text-sm text-slate-500">{formatDateTime(row.finishedAt)}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex justify-end">
                          <Link
                            to={`/results/attempts/${row.attemptId}${detailQuery ? `?${detailQuery}` : ''}`}
                            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
                          >
                            <Eye className="h-4 w-4" />
                            {row.status === 'PENDING' ? 'Проверить' : 'Посмотреть'}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        )}

        {!results.isLoading && !results.isError && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-3">
            <p className="text-sm text-slate-400">
              Показано {rows.length} из {totalElements} {pluralRu(totalElements, ['результат', 'результата', 'результатов'])}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 0}
                onClick={() => patchParams({ page: Math.max(0, page - 1) })}
              >
                Назад
              </Button>
              <span className="text-sm text-slate-500">
                Страница {page + 1} из {Math.max(totalPages, 1)}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={page + 1 >= totalPages}
                onClick={() => patchParams({ page: page + 1 })}
              >
                Далее
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
