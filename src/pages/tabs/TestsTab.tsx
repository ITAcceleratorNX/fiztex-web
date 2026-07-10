import { useMemo, useState } from 'react';
import { Plus, Pencil, Eye, UserPlus, ClipboardList, ListChecks, Trash2 } from 'lucide-react';
import { useTests, useDeleteTest } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TestStatusBadge } from '@/components/ui/TestStatusBadge';
import { TestFormModal } from '@/pages/modals/TestFormModal';
import { TestCardModal } from '@/pages/modals/TestCardModal';
import { TestQuestionsModal } from '@/pages/modals/TestQuestionsModal';
import { AssignModal } from '@/pages/modals/AssignModal';
import { formatDate, pluralRu, cx } from '@/lib/format';
import { ApiError } from '@/lib/api';
import type { Test, TestStatus } from '@/lib/types';

export function TestsTab() {
  const { data, isLoading, isError, error, refetch, isSuccess } = useTests();
  const del = useDeleteTest();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TestStatus>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Test | null>(null);
  const [cardTestId, setCardTestId] = useState<number | null>(null);
  const [questionsTestId, setQuestionsTestId] = useState<number | null>(null);
  const [assignTarget, setAssignTarget] = useState<Test | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Test | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((t) => {
      const matchQ = !q || t.title.toLowerCase().includes(q) || t.subjectName.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [data, search, statusFilter]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(t: Test) {
    setEditing(t);
    setFormOpen(true);
  }
  function tryAssign(t: Test) {
    if (t.status !== 'ACTIVE') {
      toast.info('Назначать можно только тест в статусе «Активен»');
      return;
    }
    setAssignTarget(t);
  }

  async function handleDelete(test: Test) {
    try {
      await del.mutateAsync(test.id);
      toast.success('Тест удалён');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить тест');
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Поиск по названию теста…" className="w-full max-w-xs" />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | TestStatus)}
          className="h-11 w-auto"
        >
          <option value="ALL">Статус: Все</option>
          <option value="DRAFT">Черновик</option>
          <option value="ACTIVE">Активен</option>
        </Select>
        <div className="ml-auto">
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Добавить тест
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
            title={data && data.length > 0 ? 'Ничего не найдено' : 'Пока нет тестов'}
            description={
              data && data.length > 0
                ? 'Измените поиск или фильтр.'
                : 'Создайте карточку теста, чтобы назначать его поступающим.'
            }
            action={
              data && data.length === 0 ? (
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Добавить тест
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3.5">Название</th>
                  <th className="px-6 py-3.5">Предмет</th>
                  <th className="px-6 py-3.5">Класс</th>
                  <th className="px-6 py-3.5">Версия</th>
                  <th className="px-6 py-3.5">Длит.</th>
                  <th className="px-6 py-3.5">Мин. балл</th>
                  <th className="px-6 py-3.5">Вопросы</th>
                  <th className="px-6 py-3.5">Статус</th>
                  <th className="px-6 py-3.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((t) => (
                  <tr key={t.id} className="transition hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <button
                        onClick={() => setCardTestId(t.id)}
                        className="text-left font-semibold text-slate-800 hover:text-brand-600"
                      >
                        {t.title}
                      </button>
                      {t.assignmentCount > 0 && (
                        <span className="ml-2 text-xs text-slate-400">
                          · {t.assignmentCount} {pluralRu(t.assignmentCount, ['назнач.', 'назнач.', 'назнач.'])}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{t.subjectName}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{t.grade}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-500">
                      <span className="font-medium text-slate-700">в. {t.currentVersionNumber ?? 1}</span>
                      <span className="ml-1 text-slate-400">· {formatDate(t.currentVersionCreatedAt)}</span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{t.durationMinutes} мин</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{t.minScore}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{t.questionCount}</td>
                    <td className="px-6 py-3.5">
                      <TestStatusBadge status={t.status} />
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setCardTestId(t.id)}
                          title="Открыть карточку"
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(t)}
                          title="Редактировать"
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setQuestionsTestId(t.id)}
                          title="Вопросы теста"
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <ListChecks className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => tryAssign(t)}
                          title="Назначить поступающих"
                          className={cx(
                            'rounded-lg p-2 transition',
                            t.status === 'ACTIVE'
                              ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                              : 'text-slate-300',
                          )}
                        >
                          <UserPlus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(t)}
                          disabled={t.assignmentCount > 0}
                          title={
                            t.assignmentCount > 0
                              ? 'Нельзя удалить: тест назначен поступающим'
                              : 'Удалить тест'
                          }
                          className="rounded-lg p-2 text-slate-400 transition enabled:hover:bg-red-50 enabled:hover:text-red-600 disabled:cursor-not-allowed disabled:text-slate-200"
                        >
                          <Trash2 className="h-4 w-4" />
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

      <TestFormModal open={formOpen} onClose={() => setFormOpen(false)} test={editing} />
      <TestCardModal open={cardTestId != null} onClose={() => setCardTestId(null)} testId={cardTestId} />
      <TestQuestionsModal
        open={questionsTestId != null}
        onClose={() => setQuestionsTestId(null)}
        testId={questionsTestId}
      />
      {assignTarget && (
        <AssignModal open onClose={() => setAssignTarget(null)} test={assignTarget} />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="Удалить тест?"
        confirmLabel="Удалить"
        danger
        loading={del.isPending}
        message={
          <>
            Тест <b>«{deleteTarget?.title}»</b> вместе со всеми вопросами и версиями будет удалён
            безвозвратно. Это действие нельзя отменить.
          </>
        }
      />
    </div>
  );
}
