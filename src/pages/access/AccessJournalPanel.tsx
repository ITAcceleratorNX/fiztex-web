import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import type { AccessJournalEventType, AccessJournalRow } from '@/lib/accessJournalApi';
import { useAccessJournal } from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { Field, TextInput } from '@/components/ui/Field';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { SearchInput } from '@/components/ui/SearchInput';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatDateTime } from '@/lib/format';
import {
  JOURNAL_EVENT_OPTIONS,
  detailsSummary,
  eventLabel,
  subjectRoleLabel,
} from './accessJournalModel';

const PAGE_SIZE = 25;
const COLUMNS = ['w-40', 'w-64', 'flex-1', 'w-48', 'w-24'];

/** Карточка человека есть только у трёх ролей; у остальных имя остаётся текстом. */
const PROFILE_PATHS: Partial<Record<NonNullable<AccessJournalRow['subjectRole']>, string>> = {
  STUDENT: '/students',
  PARENT: '/parents',
  TEACHER: '/teachers',
};

function subjectLink(row: AccessJournalRow): string | null {
  const base = row.subjectRole ? PROFILE_PATHS[row.subjectRole] : undefined;
  return base && row.subjectAccountId ? `${base}/${row.subjectAccountId}` : null;
}

export function AccessJournalPanel() {
  const [params, setParams] = useSearchParams();
  const typeParam = params.get('event');
  const type = JOURNAL_EVENT_OPTIONS.some((option) => option.type === typeParam)
    ? (typeParam as AccessJournalEventType)
    : undefined;
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const requestId = Number(params.get('request') ?? 0) || undefined;
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

  const journal = useAccessJournal({
    type,
    from: from || undefined,
    to: to || undefined,
    query: settledQuery || undefined,
    requestId,
    page,
    size: PAGE_SIZE,
  });

  const rows = journal.data?.content ?? [];
  const totalPages = journal.data?.totalPages ?? 0;
  const filtered = Boolean(type || from || to || settledQuery || requestId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <SearchInput
          className="flex-1"
          value={query}
          onChange={setQuery}
          placeholder="ФИО человека или того, кто действовал"
        />
        <FilterSelect
          className="lg:w-72"
          label="Действие"
          value={type ?? 'all'}
          onChange={(value) => patchParams({ event: value === 'all' ? null : value, page: null })}
        >
          <option value="all">Все действия</option>
          {JOURNAL_EVENT_OPTIONS.map((option) => (
            <option key={option.type} value={option.type}>{option.label}</option>
          ))}
        </FilterSelect>
        <Field label="С" className="lg:w-40">
          <TextInput
            type="date"
            value={from}
            onChange={(event) => patchParams({ from: event.target.value, page: null })}
          />
        </Field>
        <Field label="По" className="lg:w-40">
          <TextInput
            type="date"
            value={to}
            onChange={(event) => patchParams({ to: event.target.value, page: null })}
          />
        </Field>
      </div>

      {requestId && (
        <div className="flex items-center gap-3 rounded-lg bg-info-bg px-3 py-2 text-13 text-navy-700">
          Показана история заявки № {requestId}.
          <button
            type="button"
            className="font-medium underline"
            onClick={() => patchParams({ request: null, page: null })}
          >
            Показать весь журнал
          </button>
        </div>
      )}

      {journal.isPending && <TableSkeleton columns={COLUMNS} rows={8} />}
      {journal.isError && (
        <ErrorBlock
          message={journal.error instanceof ApiError ? journal.error.message : 'Не удалось загрузить журнал. Попробуйте ещё раз.'}
          onRetry={() => void journal.refetch()}
        />
      )}
      {!journal.isPending && !journal.isError && rows.length === 0 && (
        <div className="card">
          <EmptyBlock
            title={filtered ? 'По этим условиям записей нет' : 'Журнал пока пуст'}
            description={
              filtered
                ? 'Снимите фильтры или расширьте период.'
                : 'Здесь появятся заявки, выдача кодов, сбросы PIN и временные пароли.'
            }
          />
        </div>
      )}

      {rows.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-10 uppercase tracking-filter text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Когда</th>
                <th className="px-4 py-3 font-semibold">Действие</th>
                <th className="px-4 py-3 font-semibold">С кем</th>
                <th className="px-4 py-3 font-semibold">Кто</th>
                <th className="px-4 py-3 font-semibold">Заявка</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const event = eventLabel(row.type);
                const details = detailsSummary(row.details);
                const profile = subjectLink(row);
                const role = subjectRoleLabel(row.subjectRole);
                return (
                  <tr key={row.id} className="border-b border-slate-50 align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {formatDateTime(row.occurredAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={event.tone}>{event.label}</Badge>
                      {details.length > 0 && (
                        <div className="mt-1 text-11 text-slate-400">{details.join(' · ')}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {profile ? (
                        <Link to={profile} className="font-medium text-slate-900 hover:text-navy-700">
                          {row.subjectName}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-900">{row.subjectName ?? '—'}</span>
                      )}
                      {role && <div className="text-11 text-slate-400">{role}</div>}
                    </td>
                    {/* Подпись исполнителя — снимок на момент действия: человека могли
                        переименовать или заархивировать, а журнал помнит, кем он был. */}
                    <td className="px-4 py-3 text-slate-600">{row.actorLabel ?? '—'}</td>
                    <td className="px-4 py-3">
                      {row.requestId ? (
                        <Link
                          to={`/admin/access-codes/requests/${row.requestId}`}
                          className="text-navy-700 hover:underline"
                        >
                          № {row.requestId}
                        </Link>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-13 text-slate-500">Страница {page + 1} из {totalPages}</span>
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
