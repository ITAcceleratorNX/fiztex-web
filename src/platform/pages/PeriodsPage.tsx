import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { formatDate } from '@/lib/format';
import { PERIOD_STATUS_LABELS, PERIOD_TYPE_LABELS } from '../labels';
import { PeriodFormModal } from '../modals/PeriodFormModal';
import { listAcademicYears, listPeriods } from '../services';
import type { AcademicPeriod, AcademicYear } from '../types';

export function PeriodsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState('');
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicPeriod | null>(null);

  const loadYears = useCallback(async () => {
    const yearList = await listAcademicYears();
    setYears(yearList);
    setYearId((current) => {
      if (current && yearList.some((y) => y.id === current)) return current;
      return yearList.find((y) => y.status === 'ACTIVE')?.id || yearList[0]?.id || '';
    });
  }, []);

  const reload = useCallback(async () => {
    if (!yearId) {
      setPeriods([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPeriods(await listPeriods(yearId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить периоды');
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => {
    void loadYears().catch((err) => {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить учебные годы');
      setLoading(false);
    });
  }, [loadYears]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Периоды внутри выбранного учебного года. Добавление и редактирование на mock data.
      </p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-56">
          <Select value={yearId} onChange={(e) => setYearId(e.target.value)}>
            {years.length === 0 && <option value="">Нет учебных годов</option>}
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </Select>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          disabled={!yearId}
        >
          Добавить период
        </Button>
      </div>

      {loading && <LoadingBlock />}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void reload()} />}
      {!loading && !error && periods.length === 0 && (
        <div className="card">
          <EmptyBlock title="Периодов пока нет" description="Добавьте четверть, триместр или свой период." />
        </div>
      )}
      {!loading && !error && periods.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Название</th>
                <th className="px-4 py-3 font-semibold">Тип</th>
                <th className="px-4 py-3 font-semibold">Начало</th>
                <th className="px-4 py-3 font-semibold">Окончание</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{period.name}</td>
                  <td className="px-4 py-3 text-slate-600">{PERIOD_TYPE_LABELS[period.type]}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(period.startDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(period.endDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{PERIOD_STATUS_LABELS[period.status]}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(period);
                        setFormOpen(true);
                      }}
                    >
                      Изменить
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PeriodFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        period={editing}
        years={years}
        defaultYearId={yearId}
        onSaved={() => void reload()}
      />
    </div>
  );
}
