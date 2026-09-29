import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { SCHOOL_STATUS_LABELS } from '../labels';
import { mergeSearchParams, parsePositiveInteger } from '@/lib/listNavigation';
import { useListScrollRestoration, useListSearchParams } from '@/hooks/useListNavigation';
import { ClassFormModal } from '../modals/ClassFormModal';
import { archiveClass, listAcademicYears, listClasses } from '../services';
import type { AcademicYear, SchoolClass } from '../types';
import { useToast } from '@/context/ToastContext';
import { platformErrorMessage } from '../platformErrorMessage';

export function ClassesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useListSearchParams('classes', ['year']);
  const rawYear = searchParams.get('year');
  const yearId: string | 'ALL' = parsePositiveInteger(rawYear) ? rawYear! : 'ALL';
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  useListScrollRestoration('classes', !loading);

  useEffect(() => {
    if (rawYear && yearId === 'ALL') {
      setSearchParams(mergeSearchParams(searchParams, { year: null }), { replace: true });
    }
  }, [rawYear, searchParams, setSearchParams, yearId]);

  const returnTo = `/admin/classes${yearId === 'ALL' ? '' : `?year=${yearId}`}`;
  const detailPath = (id: string) =>
    `/admin/classes/${id}?${new URLSearchParams({ returnTo }).toString()}`;

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
      setError(platformErrorMessage(err, 'Не удалось загрузить классы. Попробуйте ещё раз.'));
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleArchive(item: SchoolClass) {
    if (!window.confirm(`Архивировать класс ${item.name}?`)) return;
    try {
      await archiveClass(item.id);
      toast.success('Класс архивирован');
      await reload();
    } catch (err) {
      toast.error(platformErrorMessage(err, 'Не удалось архивировать класс. Попробуйте ещё раз.'));
    }
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Создайте классы для выбранного учебного года. Для каждого класса укажите параллель и букву.
      </p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-56">
          <Select value={yearId} onChange={(e) => setSearchParams(
            mergeSearchParams(searchParams, { year: e.target.value === 'ALL' ? null : e.target.value }),
          )}>
            <option value="ALL">Все учебные годы</option>
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
        >
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
                <th className="px-4 py-3 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link
                      to={detailPath(item.id)}
                      className="text-navy-700 transition hover:text-navy-800 hover:underline"
                    >
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.academicYearName}</td>
                  <td className="px-4 py-3 text-slate-600">{item.studentCount}</td>
                  <td className="px-4 py-3 text-slate-600">{SCHOOL_STATUS_LABELS[item.status]}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(detailPath(item.id))}
                      >
                        Открыть
                      </Button>
                      {item.status === 'ACTIVE' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditing(item);
                              setFormOpen(true);
                            }}
                          >
                            Изменить
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void handleArchive(item)}>
                            Архив
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClassFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        years={years}
        defaultYearId={yearId === 'ALL' ? undefined : yearId}
        editing={editing}
        onSaved={() => void reload()}
      />
    </div>
  );
}
