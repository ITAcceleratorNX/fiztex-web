import { useMemo, useState } from 'react';
import { Plus, Pencil, Eye, EyeOff, BookMarked, Upload } from 'lucide-react';
import { useSubjects, useUpdateSubject } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SubjectFormModal } from '@/pages/modals/SubjectFormModal';
import { formatDate, pluralRu } from '@/lib/format';
import { ApiError } from '@/lib/api';
import type { Subject, SubjectStatus } from '@/lib/types';

export function SubjectsTab() {
  const { data, isLoading, isError, error, refetch, isSuccess } = useSubjects();
  const update = useUpdateSubject();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SubjectStatus>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [hideTarget, setHideTarget] = useState<Subject | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((s) => {
      const matchQ = !q || s.name.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [data, search, statusFilter]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(s: Subject) {
    setEditing(s);
    setFormOpen(true);
  }

  async function setStatus(subject: Subject, status: SubjectStatus) {
    try {
      await update.mutateAsync({
        id: subject.id,
        body: { name: subject.name, description: subject.description, status },
      });
      toast.success(status === 'HIDDEN' ? 'Предмет скрыт' : 'Предмет активирован');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить статус');
    } finally {
      setHideTarget(null);
    }
  }

  function toggleStatus(subject: Subject) {
    if (subject.status === 'ACTIVE') setHideTarget(subject);
    else void setStatus(subject, 'ACTIVE');
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по предмету…"
          className="w-full max-w-xs"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | SubjectStatus)}
          className="h-11 w-auto"
        >
          <option value="ALL">Статус: Все</option>
          <option value="ACTIVE">Активен</option>
          <option value="HIDDEN">Скрыт</option>
        </Select>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => toast.info('Импорт предметов появится в следующих scope')}>
            Импортировать
          </Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Добавить предмет
          </Button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <LoadingBlock label="Загрузка предметов…" />
        ) : isError ? (
          <ErrorBlock message={error instanceof ApiError ? error.message : 'Ошибка загрузки'} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyBlock
            icon={<BookMarked className="h-7 w-7" />}
            title={data && data.length > 0 ? 'Ничего не найдено' : 'Пока нет предметов'}
            description={
              data && data.length > 0
                ? 'Измените поисковый запрос или фильтр статуса.'
                : 'Создайте первый предмет, чтобы добавлять тесты.'
            }
            action={
              data && data.length === 0 ? (
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Добавить предмет
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-6 py-3.5">Предмет</th>
                <th className="px-6 py-3.5">Статус</th>
                <th className="px-6 py-3.5">Тестов</th>
                <th className="px-6 py-3.5">Дата создания</th>
                <th className="px-6 py-3.5 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((s) => (
                <tr key={s.id} className="group transition hover:bg-slate-50/70">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} />
                      <span className="font-semibold text-slate-800">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    {s.status === 'ACTIVE' ? (
                      <Badge tone="green" dot>
                        Активен
                      </Badge>
                    ) : (
                      <Badge tone="gray" dot>
                        Скрыт
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-3.5 font-semibold text-slate-700">{s.testCount}</td>
                  <td className="px-6 py-3.5 text-sm text-slate-500">{formatDate(s.createdAt)}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        title="Редактировать"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleStatus(s)}
                        title={s.status === 'ACTIVE' ? 'Скрыть' : 'Активировать'}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        {s.status === 'ACTIVE' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {isSuccess && filtered.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-3 text-sm text-slate-400">
            1–{filtered.length} из {filtered.length} {pluralRu(filtered.length, ['предмета', 'предметов', 'предметов'])}
          </div>
        )}
      </div>

      <SubjectFormModal open={formOpen} onClose={() => setFormOpen(false)} subject={editing} />

      <ConfirmDialog
        open={Boolean(hideTarget)}
        onClose={() => setHideTarget(null)}
        onConfirm={() => hideTarget && setStatus(hideTarget, 'HIDDEN')}
        title="Скрыть предмет?"
        confirmLabel="Скрыть"
        loading={update.isPending}
        message={
          <>
            Предмет <b>«{hideTarget?.name}»</b> нельзя будет выбрать при создании новых тестов.
            Существующие тесты, версии и назначения не пострадают.
          </>
        }
      />
    </div>
  );
}
