import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { SCHOOL_STATUS_LABELS } from '../labels';
import { ClassFormModal } from '../modals/ClassFormModal';
import { listAcademicYears, listClasses } from '../services';
import type { AcademicYear, SchoolClass } from '../types';

export function ClassesPage() {
  const [yearId, setYearId] = useState<string | 'ALL'>('ALL');
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [yearList, classList] = await Promise.all([
        listAcademicYears(),
        listClasses({ academicYearId: yearId }),
      ]);
      setYears(yearList);
      setClasses(classList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить классы');
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Классы с реального backend. Создание требует параллель и букву.
      </p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-56">
          <Select value={yearId} onChange={(e) => setYearId(e.target.value)}>
            <option value="ALL">Все учебные годы</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </Select>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
          Создать класс
        </Button>
      </div>

      {loading && <LoadingBlock />}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void reload()} />}
      {!loading && !error && classes.length === 0 && (
        <div className="card">
          <EmptyBlock title="Классов пока нет" description="Создайте класс и привяжите к учебному году." />
        </div>
      )}
      {!loading && !error && classes.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Класс</th>
                <th className="px-4 py-3 font-semibold">Учебный год</th>
                <th className="px-4 py-3 font-semibold">Учеников</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-3 text-slate-600">{item.academicYearName}</td>
                  <td className="px-4 py-3 text-slate-600">{item.studentCount}</td>
                  <td className="px-4 py-3 text-slate-600">{SCHOOL_STATUS_LABELS[item.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClassFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        years={years}
        defaultYearId={yearId === 'ALL' ? undefined : yearId}
        onSaved={() => void reload()}
      />
    </div>
  );
}
