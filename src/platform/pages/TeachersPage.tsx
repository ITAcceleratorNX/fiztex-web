import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { SCHOOL_STATUS_LABELS } from '../labels';
import { CreateAssignmentModal } from '../modals/CreateAssignmentModal';
import { CreateTeacherModal } from '../modals/CreateTeacherModal';
import { TeacherDetailModal } from '../modals/TeacherDetailModal';
import { archiveTeacher, listTeachers } from '../services';
import type { TeacherProfile } from '../types';
import { formatPersonName } from '../types';

export function TeachersPage() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<TeacherProfile | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listTeachers({ name: query.trim() || undefined });
      setTeachers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить учителей');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const handle = window.setTimeout(() => void reload(), query ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [reload, query]);

  async function handleArchive(teacher: TeacherProfile) {
    if (
      !window.confirm(
        `Архивировать ${formatPersonName(teacher.lastName, teacher.firstName)}?`,
      )
    ) {
      return;
    }
    try {
      await archiveTeacher(teacher.id);
      toast.success('Учитель архивирован');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось архивировать');
    }
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Карточки учителей с backend. Доступность редактируется в{' '}
        <Link to="/admin/schedule-settings" className="text-brand-600 underline">
          настройках расписания
        </Link>
        .
      </p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          className="flex-1"
          value={query}
          onChange={setQuery}
          placeholder="Поиск по ФИО"
        />
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          Создать
        </Button>
      </div>

      {loading && <LoadingBlock />}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void reload()} />}
      {!loading && !error && teachers.length === 0 && (
        <div className="card">
          <EmptyBlock title="Учителей нет" description="Создайте учителя или импортируйте." />
        </div>
      )}
      {!loading && !error && teachers.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">ФИО</th>
                <th className="px-4 py-3 font-semibold">Телефон</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <button
                      type="button"
                      className="text-left hover:text-brand-600"
                      onClick={() => {
                        setSelected(t);
                        setDetailOpen(true);
                      }}
                    >
                      {formatPersonName(t.lastName, t.firstName, t.middleName)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{SCHOOL_STATUS_LABELS[t.status]}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        className="!h-8 !px-2.5 !text-xs"
                        onClick={() => {
                          setSelected(t);
                          setAssignOpen(true);
                        }}
                      >
                        Назначить
                      </Button>
                      {t.status === 'ACTIVE' && (
                        <Button
                          variant="secondary"
                          className="!h-8 !px-2.5 !text-xs"
                          onClick={() => void handleArchive(t)}
                        >
                          Архив
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateTeacherModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => void reload()}
      />
      <CreateAssignmentModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        teacher={selected}
        onSaved={() => void reload()}
      />
      <TeacherDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        teacher={selected}
        onAssign={() => {
          setDetailOpen(false);
          setAssignOpen(true);
        }}
        onChanged={() => void reload()}
      />
    </div>
  );
}
