import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { formatDate, initials, pluralRu } from '@/lib/format';
import { parsePositiveInteger } from '@/lib/listNavigation';
import { ROLE_AVATAR_COLOR, SCHOOL_STATUS_LABELS } from '../labels';
import {
  ProfileBreadcrumb,
  ProfileCard,
  ProfileCardTitle,
  ProfileStatusBadge,
} from '../components/ProfileChrome';
import { ClassFormModal } from '../modals/ClassFormModal';
import { HomeroomAssignmentCard } from '../components/HomeroomAssignmentCard';
import { archiveClass, getClass, listAcademicYears, listStudents } from '../services';
import type { AcademicYear, SchoolClass, StudentProfile } from '../types';
import { formatPersonName } from '../types';

export function ClassDetailPage() {
  const { classId: classIdParam } = useParams();
  const classId = classIdParam ?? '';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const backTo = (() => {
    const raw = searchParams.get('returnTo');
    if (!raw) return '/admin/classes';
    try {
      const target = new URL(raw, window.location.origin);
      if (target.origin !== window.location.origin || target.pathname !== '/admin/classes' || target.hash) {
        return '/admin/classes';
      }
      const year = target.searchParams.get('year');
      if ([...target.searchParams.keys()].some((key) => key !== 'year')) return '/admin/classes';
      return year && parsePositiveInteger(year) ? `/admin/classes?year=${year}` : '/admin/classes';
    } catch {
      return '/admin/classes';
    }
  })();

  const [schoolClass, setSchoolClass] = useState<SchoolClass | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearsError, setYearsError] = useState(false);
  const [studentsError, setStudentsError] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const numericClassId = Number(classId);
  const validId = Boolean(classId) && Number.isSafeInteger(numericClassId) && numericClassId > 0;

  const reload = useCallback(async () => {
    if (!validId) return;
    setLoading(true);
    setError(null);
    setYearsError(false);
    setStudentsError(false);
    try {
      const [classResult, yearsResult, rosterResult] = await Promise.allSettled([
        getClass(classId),
        listAcademicYears(),
        listStudents({ classId: numericClassId, status: 'ACTIVE' }),
      ]);
      if (classResult.status === 'rejected') throw classResult.reason;
      const cls = classResult.value;
      if (!cls) {
        setSchoolClass(null);
        setStudents([]);
        setError('Класс не найден');
        return;
      }
      const yearList = yearsResult.status === 'fulfilled' ? yearsResult.value : [];
      setYears(yearList);
      setYearsError(yearsResult.status === 'rejected');
      setSchoolClass({
        ...cls,
        academicYearName: yearList.find((year) => year.id === cls.academicYearId)?.name ?? '',
      });
      setStudents(rosterResult.status === 'fulfilled' ? rosterResult.value : []);
      setStudentsError(rosterResult.status === 'rejected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить класс');
    } finally {
      setLoading(false);
    }
  }, [classId, numericClassId, validId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sortedStudents = useMemo(
    () =>
      [...students].sort((a, b) => {
        const byLast = a.lastName.localeCompare(b.lastName, 'ru');
        if (byLast !== 0) return byLast;
        return a.firstName.localeCompare(b.firstName, 'ru');
      }),
    [students],
  );

  async function handleArchive() {
    if (!schoolClass) return;
    if (!window.confirm(`Архивировать класс ${schoolClass.name}?`)) return;
    try {
      await archiveClass(schoolClass.id);
      toast.success('Класс архивирован');
      navigate(backTo, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось архивировать');
    }
  }

  if (!validId) {
    return <ErrorBlock message="Некорректный идентификатор класса." />;
  }

  return (
    <div className="flex flex-col gap-8">
      {loading ? (
        <ProfileCard>
          <LoadingBlock label="Загрузка класса…" />
        </ProfileCard>
      ) : error || !schoolClass ? (
        <ProfileCard>
          <ErrorBlock message={error ?? 'Класс не найден'} onRetry={() => void reload()} />
        </ProfileCard>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <ProfileBreadcrumb
              items={[
                { label: 'Классы', to: backTo },
                { label: schoolClass.name },
              ]}
            />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <h1 className="text-[28px] font-bold leading-none text-[#1a1f36]">
                  {schoolClass.name}
                </h1>
                <span
                  className={
                    schoolClass.status === 'ACTIVE'
                      ? 'inline-flex items-center rounded-[20px] bg-[#ecfdf5] px-2.5 py-1 text-13 font-semibold text-[#059669]'
                      : 'inline-flex items-center rounded-[20px] bg-slate-100 px-2.5 py-1 text-13 font-semibold text-slate-500'
                  }
                >
                  {SCHOOL_STATUS_LABELS[schoolClass.status]}
                </span>
              </div>
              {schoolClass.status === 'ACTIVE' && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setFormOpen(true)}>
                    Изменить
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void handleArchive()}>
                    Архив
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <ProfileCard>
              <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#9ca3af]">
                Учебный год
              </p>
              <p className="mt-2 text-lg font-bold text-[#1a1f36]">
                {schoolClass.academicYearName || '—'}
              </p>
              {yearsError && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span>Не удалось загрузить учебный год.</span>
                  <Button variant="secondary" size="sm" onClick={() => void reload()}>Повторить</Button>
                </div>
              )}
            </ProfileCard>
            <ProfileCard>
              <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#9ca3af]">
                Учеников
              </p>
              <p className="mt-2 text-lg font-bold text-[#1a1f36]">
                {schoolClass.studentCount}{' '}
                <span className="text-sm font-medium text-slate-500">
                  {pluralRu(schoolClass.studentCount, ['ученик', 'ученика', 'учеников'])}
                </span>
              </p>
            </ProfileCard>
            <ProfileCard>
              <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#9ca3af]">
                Создан
              </p>
              <p className="mt-2 text-lg font-bold text-[#1a1f36]">
                {formatDate(schoolClass.createdAt)}
              </p>
            </ProfileCard>
          </div>

          <HomeroomAssignmentCard classId={numericClassId} />

          <ProfileCard className="p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <ProfileCardTitle>Список учеников</ProfileCardTitle>
              <span className="text-13 text-slate-500">
                {schoolClass.studentCount}{' '}
                {pluralRu(schoolClass.studentCount, ['ученик', 'ученика', 'учеников'])}
              </span>
            </div>

            {studentsError ? (
              <ErrorBlock message="Не удалось загрузить данные класса." onRetry={() => void reload()} />
            ) : sortedStudents.length === 0 ? (
              <div className="p-6">
                <EmptyBlock
                  title="В классе пока нет учеников"
                  description="Зачислите ученика при создании профиля или через карточку ученика."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Ученик</th>
                      <th className="px-4 py-3 font-semibold">Дата рождения</th>
                      <th className="px-4 py-3 font-semibold">Статус аккаунта</th>
                      <th className="px-4 py-3 font-semibold text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map((student) => {
                      const name = formatPersonName(
                        student.lastName,
                        student.firstName,
                        student.middleName,
                      );
                      const avatar = ROLE_AVATAR_COLOR.STUDENT;
                      return (
                        <tr
                          key={student.id}
                          className="border-b border-slate-50 last:border-0"
                        >
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <span
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-2xl text-xs font-bold text-white"
                                style={{ backgroundColor: avatar.bg }}
                              >
                                {initials(name)}
                              </span>
                              <span className="font-medium text-slate-900">{name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {student.birthDate ? formatDate(student.birthDate) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <ProfileStatusBadge status={student.accountStatus} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              to={`/students/${student.accountId}`}
                              className="text-13 font-semibold text-navy-700 transition hover:text-navy-800"
                            >
                              Открыть
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </ProfileCard>

          <ClassFormModal
            open={formOpen}
            onClose={() => setFormOpen(false)}
            years={years}
            defaultYearId={schoolClass.academicYearId}
            editing={schoolClass}
            onSaved={() => void reload()}
          />
        </>
      )}
    </div>
  );
}
