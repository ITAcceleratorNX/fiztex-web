import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, ClipboardList } from 'lucide-react';
import { useTests } from '@/hooks/queries';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { TestStatusBadge } from '@/components/ui/TestStatusBadge';
import { TestFormModal } from '@/pages/modals/TestFormModal';
import { formatDate, pluralRu } from '@/lib/format';
import { ApiError } from '@/lib/api';
import { mergeSearchParams } from '@/lib/listNavigation';
import type { Test, TestStatus } from '@/lib/types';

export function AdmissionTestsTab() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, isError, error, refetch, isSuccess } = useTests(false);

  const search = searchParams.get('testQ') ?? '';
  const rawStatus = searchParams.get('testStatus');
  const statusFilter: 'ALL' | TestStatus = rawStatus === 'DRAFT' || rawStatus === 'ACTIVE'
    ? rawStatus
    : 'ALL';
  const [editing, setEditing] = useState<Test | null>(null);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (!search) next.delete('testQ');
    if (statusFilter === 'ALL') next.delete('testStatus');
    else next.set('testStatus', statusFilter);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [search, searchParams, setSearchParams, statusFilter]);

  function updateSearch(value: string) {
    setSearchParams(mergeSearchParams(searchParams, { testQ: value || null }), { replace: true });
  }

  function updateStatus(value: 'ALL' | TestStatus) {
    setSearchParams(mergeSearchParams(searchParams, { testStatus: value === 'ALL' ? null : value }));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((t) => {
      const matchQ = !q || t.title.toLowerCase().includes(q) || t.subjectName.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [data, search, statusFilter]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={updateSearch} placeholder="Поиск по названию…" className="w-full max-w-xs" />
        <Select
          value={statusFilter}
          onChange={(e) => updateStatus(e.target.value as 'ALL' | TestStatus)}
          className="h-11 w-auto"
        >
          <option value="ALL">Статус: Все</option>
          <option value="DRAFT">Черновик</option>
          <option value="ACTIVE">Активен</option>
        </Select>
        <div className="ml-auto">
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/admissions/tests/new')}>
            Создать тест
          </Button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <LoadingBlock label="Загрузка тестов…" />
        ) : isError ? (
          <ErrorBlock message={error instanceof ApiError ? error.message : 'Ошибка загрузки'} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyBlock
            icon={<ClipboardList className="h-7 w-7" />}
            title={data && data.length > 0 ? 'Ничего не найдено' : 'Пока нет вступительных тестов'}
            description={
              data && data.length > 0
                ? 'Измените поиск или фильтр.'
                : 'Создайте тест с ручными вопросами и назначьте его поступающим. Для AI-тестов используйте раздел «AI-тесты».'
            }
            action={
              data && data.length === 0 ? (
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/admissions/tests/new')}>
                  Создать тест
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3.5">Название теста</th>
                  <th className="px-6 py-3.5">Предмет</th>
                  <th className="px-6 py-3.5">Класс</th>
                  <th className="px-6 py-3.5">Статус</th>
                  <th className="px-6 py-3.5">Версия</th>
                  <th className="px-6 py-3.5">Назначений</th>
                  <th className="px-6 py-3.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="transition hover:bg-slate-50/70"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={t.subjectName} size="sm" />
                        <Link
                          to={`/admissions/tests/${t.id}`}
                          className="font-semibold text-slate-800 hover:text-brand-600"
                        >
                          {t.title}
                        </Link>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{t.subjectName}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{t.grade}</td>
                    <td className="px-6 py-3.5">
                      <TestStatusBadge status={t.status} />
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-500">
                      <span className="font-medium text-slate-700">v{t.currentVersionNumber ?? 1}</span>
                      <span className="ml-1 text-slate-400">· {formatDate(t.currentVersionCreatedAt)}</span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">
                      {t.assignmentCount} {pluralRu(t.assignmentCount, ['чел.', 'чел.', 'чел.'])}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(t);
                          }}
                          title="Редактировать"
                          aria-label={`Редактировать тест «${t.title}»`}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isSuccess && filtered.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-3 text-sm text-slate-400">
            1–{filtered.length} из {filtered.length} {pluralRu(filtered.length, ['теста', 'тестов', 'тестов'])}
          </div>
        )}
      </div>

      <TestFormModal open={editing != null} onClose={() => setEditing(null)} test={editing} aiTest={false} />
    </div>
  );
}
