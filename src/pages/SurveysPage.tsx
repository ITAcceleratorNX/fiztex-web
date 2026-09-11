import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ListChecks } from 'lucide-react';
import { useSurveys } from '@/hooks/surveyQueries';
import { StatCard } from '@/components/ui/StatCard';
import { Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { SurveyStatusBadge } from '@/components/ui/SurveyStatusBadge';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { SurveyCreateModal } from '@/pages/modals/SurveyCreateModal';
import { ROUTES } from '@/lib/routes';
import { ApiError } from '@/lib/api';
import type { SurveyStatus } from '@/lib/surveyApi';

/**
 * Список опросов (Опросы, Phase 2). Список один — без фильтра статуса, список школы
 * короткий, — а счётчики сверху и таблица снизу читают его целиком: фильтр статуса
 * сужает только видимые строки, сводка остаётся про весь список.
 */
export function SurveysPage() {
  const navigate = useNavigate();
  const surveys = useSurveys();
  const [statusFilter, setStatusFilter] = useState<'ALL' | SurveyStatus>('ALL');
  const [createOpen, setCreateOpen] = useState(false);

  const allRows = surveys.data?.content ?? [];
  const summary = useMemo(
    () => ({
      total: allRows.length,
      active: allRows.filter((r) => r.status === 'ACTIVE').length,
      draft: allRows.filter((r) => r.status === 'DRAFT').length,
    }),
    [allRows],
  );

  const rows = useMemo(
    () => (statusFilter === 'ALL' ? allRows : allRows.filter((r) => r.status === statusFilter)),
    [allRows, statusFilter],
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
            Опросы
          </h1>
          <p className="mt-1 max-w-2xl text-slate-500">
            Опросы для учеников и родителей: вопросы, аудитория, результаты и AI-анализ ответов.
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          Создать опрос
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Всего" value={surveys.isSuccess ? summary.total : '—'} />
        <StatCard label="Активных" value={surveys.isSuccess ? summary.active : '—'} />
        <StatCard label="Черновиков" value={surveys.isSuccess ? summary.draft : '—'} />
      </div>

      <div className="mb-4 mt-6 flex items-center gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | SurveyStatus)}
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
            title={statusFilter === 'ALL' ? 'Пока нет опросов' : 'Ничего не найдено'}
            description={
              statusFilter === 'ALL'
                ? 'Создайте опрос, добавьте вопросы и выберите аудиторию.'
                : 'Измените фильтр по статусу.'
            }
            action={
              statusFilter === 'ALL' ? (
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                  Создать опрос
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
                    onClick={() => navigate(ROUTES.survey(row.id as number))}
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

      <SurveyCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => navigate(ROUTES.survey(id))}
      />
    </div>
  );
}
