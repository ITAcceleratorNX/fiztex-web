import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Eye, Sparkles, ListChecks, Trash2, FolderOpen } from 'lucide-react';
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
import { formatDate, pluralRu } from '@/lib/format';
import { countDraftQuestions } from '@/lib/testQuestions';
import { ApiError } from '@/lib/api';
import type { Test, TestStatus } from '@/lib/types';

export function AiTestsTab() {
  const { data, isLoading, isError, error, refetch, isSuccess } = useTests(true);
  const del = useDeleteTest();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TestStatus>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Test | null>(null);
  const [cardTestId, setCardTestId] = useState<number | null>(null);
  const [questionsTestId, setQuestionsTestId] = useState<number | null>(null);
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

  async function handleDelete(test: Test) {
    try {
      await del.mutateAsync(test.id);
      toast.success('AI-тест удалён');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить тест');
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по названию или предмету…"
          className="w-full max-w-xs"
        />
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
            Создать AI-тест
          </Button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <LoadingBlock label="Загрузка AI-тестов…" />
        ) : isError ? (
          <ErrorBlock message={error instanceof ApiError ? error.message : 'Ошибка загрузки'} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyBlock
            icon={<Sparkles className="h-7 w-7" />}
            title={data && data.length > 0 ? 'Ничего не найдено' : 'Пока нет AI-тестов'}
            description={
              data && data.length > 0
                ? 'Измените поиск или фильтр.'
                : 'Создайте тест, загрузите материалы предмета и сгенерируйте вопросы через AI.'
            }
            action={
              data && data.length === 0 ? (
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Создать AI-тест
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3.5">Название</th>
                  <th className="px-6 py-3.5">Предмет</th>
                  <th className="px-6 py-3.5">Класс</th>
                  <th className="px-6 py-3.5">Версия</th>
                  <th className="px-6 py-3.5">Вопросы</th>
                  <th className="px-6 py-3.5">Черновики</th>
                  <th className="px-6 py-3.5">Статус</th>
                  <th className="px-6 py-3.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((t) => {
                  const drafts = countDraftQuestions(t.questions);
                  return (
                    <tr key={t.id} className="transition hover:bg-slate-50/70">
                      <td className="px-6 py-3.5">
                        <button
                          onClick={() => setCardTestId(t.id)}
                          className="text-left font-semibold text-slate-800 hover:text-brand-600"
                        >
                          {t.title}
                        </button>
                      </td>
                      <td className="px-6 py-3.5 text-sm text-slate-600">{t.subjectName}</td>
                      <td className="px-6 py-3.5 text-sm text-slate-600">{t.grade}</td>
                      <td className="px-6 py-3.5 text-sm text-slate-500">
                        <span className="font-medium text-slate-700">в. {t.currentVersionNumber ?? 1}</span>
                        <span className="ml-1 text-slate-400">· {formatDate(t.currentVersionCreatedAt)}</span>
                      </td>
                      <td className="px-6 py-3.5 text-sm text-slate-600">{t.questionCount}</td>
                      <td className="px-6 py-3.5 text-sm">
                        {drafts > 0 ? (
                          <span className="font-medium text-amber-700">{drafts}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
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
                          <Link
                            to={`/subjects/${t.subjectId}/materials`}
                            title="Материалы предмета"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <FolderOpen className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => openEdit(t)}
                            title="Редактировать"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setQuestionsTestId(t.id)}
                            title="Вопросы и ревью"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <ListChecks className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(t)}
                            title="Удалить тест"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {isSuccess && filtered.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-3 text-sm text-slate-400">
            1–{filtered.length} из {filtered.length}{' '}
            {pluralRu(filtered.length, ['AI-теста', 'AI-тестов', 'AI-тестов'])}
          </div>
        )}
      </div>

      <TestFormModal open={formOpen} onClose={() => setFormOpen(false)} test={editing} aiTest />
      <TestCardModal
        open={cardTestId != null}
        onClose={() => setCardTestId(null)}
        testId={cardTestId}
        variant="ai"
      />
      <TestQuestionsModal
        open={questionsTestId != null}
        onClose={() => setQuestionsTestId(null)}
        testId={questionsTestId}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="Удалить AI-тест?"
        confirmLabel="Удалить"
        danger
        loading={del.isPending}
        message={
          <>
            Тест <b>«{deleteTarget?.title}»</b> вместе со всеми вопросами и версиями будет удалён
            безвозвратно.
          </>
        }
      />
    </div>
  );
}
