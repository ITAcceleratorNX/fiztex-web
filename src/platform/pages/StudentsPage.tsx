import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { STUDENT_STATUS_LABELS } from '../labels';
import { AddToClassModal } from '../modals/AddToClassModal';
import { CreateStudentModal } from '../modals/CreateStudentModal';
import { StudentDetailModal } from '../modals/StudentDetailModal';
import { archiveStudent, listAcademicYears, listClasses, listStudents } from '../services';
import type { SchoolClass, StudentProfile, StudentProfileStatus } from '../types';
import { formatPersonName } from '../types';

export function StudentsPage() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState<StudentProfileStatus | 'ALL'>('ACTIVE');
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<StudentProfile | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const years = await listAcademicYears();
      const activeYear = years.find((y) => y.status === 'ACTIVE') ?? years[0];
      const classList = await listClasses({
        academicYearId: activeYear ? activeYear.id : 'ALL',
      });
      setClasses(classList);
      const list = await listStudents({
        name: name.trim() || undefined,
        classId: classId ? Number(classId) : undefined,
        status: status === 'ALL' ? undefined : status,
      });
      setStudents(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить учеников');
    } finally {
      setLoading(false);
    }
  }, [name, classId, status]);

  useEffect(() => {
    const handle = window.setTimeout(() => void reload(), name ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [reload, name]);

  async function handleArchive(student: StudentProfile) {
    if (!window.confirm(`Архивировать ${formatPersonName(student.lastName, student.firstName)}?`)) {
      return;
    }
    try {
      await archiveStudent(student.id);
      toast.success('Ученик архивирован');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось архивировать');
    }
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Карточка ученика создаётся вместе с аккаунтом. Чтобы ученик появился в классе — добавьте
        membership.
      </p>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          className="flex-1"
          value={name}
          onChange={setName}
          placeholder="Поиск по ФИО"
        />
        <div className="lg:w-48">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Все классы</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="lg:w-40">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as StudentProfileStatus | 'ALL')}
          >
            <option value="ALL">Все статусы</option>
            <option value="ACTIVE">Активен</option>
            <option value="ARCHIVED">Архив</option>
          </Select>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          Создать
        </Button>
      </div>

      {loading && <LoadingBlock />}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void reload()} />}
      {!loading && !error && students.length === 0 && (
        <div className="card">
          <EmptyBlock title="Учеников нет" description="Создайте ученика или импортируйте список." />
        </div>
      )}
      {!loading && !error && students.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">ФИО</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <button
                      type="button"
                      className="text-left hover:text-brand-600"
                      onClick={() => {
                        setSelected(s);
                        setDetailOpen(true);
                      }}
                    >
                      {formatPersonName(s.lastName, s.firstName, s.middleName)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{STUDENT_STATUS_LABELS[s.status]}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        className="!h-8 !px-2.5 !text-xs"
                        onClick={() => {
                          setSelected(s);
                          setAddOpen(true);
                        }}
                      >
                        В класс
                      </Button>
                      {s.status === 'ACTIVE' && (
                        <Button
                          variant="secondary"
                          className="!h-8 !px-2.5 !text-xs"
                          onClick={() => void handleArchive(s)}
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

      <CreateStudentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        classes={classes}
        onSaved={() => void reload()}
      />
      <AddToClassModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        student={selected}
        classes={classes}
        onSaved={() => void reload()}
      />
      <StudentDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        student={selected}
        onAddToClass={() => {
          setDetailOpen(false);
          setAddOpen(true);
        }}
        onChanged={() => void reload()}
      />
    </div>
  );
}
