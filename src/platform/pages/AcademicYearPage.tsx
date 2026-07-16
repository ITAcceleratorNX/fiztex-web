import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { formatDate } from '@/lib/format';
import { YEAR_STATUS_LABELS } from '../labels';
import { AcademicYearFormModal } from '../modals/AcademicYearFormModal';
import { activateAcademicYear, archiveAcademicYear, listAcademicYears } from '../services';
import type { AcademicYear } from '../types';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';

export function AcademicYearPage() {
  const toast = useToast();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicYear | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setYears(await listAcademicYears());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить учебные годы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleActivate(year: AcademicYear) {
    try {
      await activateAcademicYear(year.id);
      toast.success('Учебный год активирован');
      await reload();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ANOTHER_YEAR_ACTIVE') {
        toast.error('Сначала архивируйте текущий ACTIVE год, затем активируйте этот');
      } else {
        toast.error(err instanceof Error ? err.message : 'Не удалось активировать');
      }
    }
  }

  async function handleArchive(year: AcademicYear) {
    if (!window.confirm(`Архивировать «${year.name}»?`)) return;
    try {
      await archiveAcademicYear(year.id);
      toast.success('Учебный год архивирован');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось архивировать');
    }
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Учебные годы с реального backend. Одновременно активен только один год: при ошибке{' '}
        <code className="rounded bg-slate-100 px-1">ANOTHER_YEAR_ACTIVE</code> сначала архивируйте
        текущий ACTIVE, затем активируйте нужный.
      </p>

      <div className="mb-4">
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          Создать учебный год
        </Button>
      </div>

      {loading && <LoadingBlock />}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void reload()} />}
      {!loading && !error && years.length === 0 && (
        <div className="card">
          <EmptyBlock title="Учебных годов пока нет" description="Добавьте год, например 2026/2027." />
        </div>
      )}
      {!loading && !error && years.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Название</th>
                <th className="px-4 py-3 font-semibold">Начало</th>
                <th className="px-4 py-3 font-semibold">Окончание</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) => (
                <tr key={year.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{year.name}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(year.startDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(year.endDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{YEAR_STATUS_LABELS[year.status]}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(year);
                          setFormOpen(true);
                        }}
                      >
                        Изменить
                      </Button>
                      {year.status === 'DRAFT' && (
                        <Button variant="ghost" size="sm" onClick={() => void handleActivate(year)}>
                          Активировать
                        </Button>
                      )}
                      {year.status !== 'ARCHIVED' && (
                        <Button variant="ghost" size="sm" onClick={() => void handleArchive(year)}>
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

      <AcademicYearFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        year={editing}
        onSaved={() => void reload()}
      />
    </div>
  );
}
