import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { cx, formatDate, formatWeekdayDayMonth, pluralRu } from '@/lib/format';
import { WEEKDAYS_ORDER, WEEKDAY_SHORT_LABELS } from '../labels';
import { AccountActionsMenu } from '../components/AccountActionsMenu';
import {
  ProfileBreadcrumb,
  ProfileCard,
  ProfileCardTitle,
  ProfileEditButton,
  ProfileInfoField,
  ProfileLinkAction,
  ProfileStatusBadge,
} from '../components/ProfileChrome';
import { CreateAssignmentModal } from '../modals/CreateAssignmentModal';
import { useTeacherAvailability } from '../hooks/useTeacherAvailability';
import { TeacherAvailabilityCard } from './schedule/TeacherAvailabilityCard';
import {
  archiveTeacherAssignment,
  archiveUser,
  blockUser,
  getTeacherByAccount,
  getTeacherTodayLessons,
  resetAccess,
  unblockUser,
  updateTeacher,
} from '../services';
import type { TeacherProfileDetail, TeacherTodayLesson } from '../types';
import { formatPersonName } from '../types';

export function TeacherProfilePage() {
  const { accountId: accountIdParam } = useParams();
  const accountId = Number(accountIdParam);
  const navigate = useNavigate();
  const toast = useToast();

  const [detail, setDetail] = useState<TeacherProfileDetail | null>(null);
  const [todayLessons, setTodayLessons] = useState<TeacherTodayLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getTeacherByAccount(accountId);
      const lessons = await getTeacherTodayLessons(d.id);
      setDetail(d);
      setTodayLessons(lessons);
      setLastName(d.lastName);
      setFirstName(d.firstName);
      setMiddleName(d.middleName ?? '');
      setPhone(d.phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить учителя');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (Number.isFinite(accountId)) void reload();
  }, [accountId, reload]);

  const availabilityQuery = useTeacherAvailability(detail?.id ?? null);
  const availability = availabilityQuery.data;
  const workHoursRange = useMemo(() => {
    const intervals = availability?.intervals ?? [];
    if (intervals.length === 0) return null;
    const start = intervals.map((i) => i.startTime).sort()[0];
    const end = intervals.map((i) => i.endTime).sort().at(-1)!;
    return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
  }, [availability]);

  const subjects = useMemo(
    () => Array.from(new Set(detail?.assignments.map((a) => a.schoolSubjectName) ?? [])),
    [detail],
  );
  const classChips = useMemo(() => {
    if (!detail) return [];
    const seen = new Set<number>();
    return detail.assignments.filter((a) => {
      if (seen.has(a.classId)) return false;
      seen.add(a.classId);
      return true;
    });
  }, [detail]);
  const assignedClassIds = useMemo(() => classChips.map((a) => a.classId), [classChips]);
  const studentCountByClassId = useMemo(() => {
    const map = new Map<number, number>();
    detail?.assignments.forEach((a) => map.set(a.classId, a.studentCount));
    return map;
  }, [detail]);
  const totalStudents = useMemo(
    () => assignedClassIds.reduce((sum, classId) => sum + (studentCountByClassId.get(classId) ?? 0), 0),
    [assignedClassIds, studentCountByClassId],
  );

  async function handleSave() {
    if (!detail) return;
    setSaving(true);
    try {
      await updateTeacher(detail.id, { lastName, firstName, middleName: middleName || null, phone });
      toast.success('Профиль обновлён');
      setEditing(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetAccess() {
    try {
      const res = await resetAccess(String(accountId), 'TEACHER');
      setIssuedCode(res.issuedCode ?? null);
      toast.success('Новый код активации выпущен');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сбросить доступ');
    }
  }

  async function handleBlock() {
    try {
      await blockUser(String(accountId));
      toast.success('Аккаунт заблокирован');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось заблокировать');
    }
  }

  async function handleUnblock() {
    try {
      await unblockUser(String(accountId));
      toast.success('Аккаунт разблокирован');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось разблокировать');
    }
  }

  async function handleArchive() {
    try {
      await archiveUser(String(accountId));
      toast.success('Учитель переведён в архив');
      navigate('/teachers', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось перевести в архив');
      setArchiveOpen(false);
    }
  }

  async function handleRemoveAssignment(id: number) {
    if (!window.confirm('Снять назначение с класса?')) return;
    try {
      await archiveTeacherAssignment(id);
      toast.success('Назначение снято');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось снять назначение');
    }
  }

  if (!Number.isFinite(accountId)) {
    return <ErrorBlock message="Некорректный идентификатор учителя." />;
  }

  const name = detail ? formatPersonName(detail.lastName, detail.firstName, detail.middleName) : '';

  return (
    <div className="flex flex-col gap-8">
      {loading ? (
        <ProfileCard>
          <LoadingBlock label="Загрузка учителя…" />
        </ProfileCard>
      ) : error || !detail ? (
        <ProfileCard>
          <ErrorBlock message={error ?? 'Учитель не найден'} onRetry={() => void reload()} />
        </ProfileCard>
      ) : (
        <>
          <ProfileBreadcrumb
            items={[
              { label: 'Пользователи', to: '/admin/users' },
              { label: 'Учителя', to: '/teachers' },
              { label: name },
            ]}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="flex flex-col gap-6">
              <ProfileCard className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h1 className="text-[28px] font-bold leading-none text-[#1a1f36]">{name}</h1>
                      <ProfileStatusBadge status={detail.accountStatus} />
                    </div>
                    {editing ? (
                      <div className="mt-4 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Фамилия" required>
                          <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} />
                        </Field>
                        <Field label="Имя" required>
                          <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                        </Field>
                        <Field label="Отчество">
                          <TextInput value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
                        </Field>
                        <Field label="Телефон" required>
                          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
                        </Field>
                        <div className="flex items-end gap-2 sm:col-span-2">
                          <Button loading={saving} onClick={() => void handleSave()}>
                            Сохранить
                          </Button>
                          <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[#6b7280]">
                        <span>Роль: </span>
                        <span className="font-semibold text-[#1a1f36]">Учитель</span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span>Телефон: </span>
                        <span className="font-semibold text-[#1a1f36]">{detail.phone}</span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span>Email: </span>
                        <span className="font-semibold text-[#1a1f36]">{detail.email ?? '—'}</span>
                        {issuedCode && (
                          <>
                            <span className="mx-2 text-slate-300">·</span>
                            <span>Код: </span>
                            <span className="font-semibold text-navy-700">{issuedCode}</span>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <ProfileEditButton onClick={() => setEditing((v) => !v)} />
                    <AccountActionsMenu
                      status={detail.accountStatus}
                      onBlock={() => void handleBlock()}
                      onUnblock={() => void handleUnblock()}
                      onArchive={() => setArchiveOpen(true)}
                      onResetAccess={() => void handleResetAccess()}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-semibold uppercase text-[#9ca3af]">Предметы</p>
                    {subjects.length === 0 ? (
                      <p className="text-sm text-[#9ca3af]">Нет назначений</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {subjects.map((s) => (
                          <span
                            key={s}
                            className="rounded-md bg-[rgba(39,65,133,0.08)] px-2.5 py-1 text-sm font-semibold text-navy-700"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-semibold uppercase text-[#9ca3af]">Классы</p>
                    {classChips.length === 0 ? (
                      <p className="text-sm text-[#9ca3af]">Нет назначений</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {classChips.map((a) => (
                          <span
                            key={a.classId}
                            className="rounded-md bg-[rgba(251,146,60,0.08)] px-2.5 py-1 text-sm font-semibold text-brand-500"
                          >
                            {a.className}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase text-[#9ca3af]">
                        Рабочие дни и часы
                      </p>
                      <button
                        type="button"
                        onClick={() => setAvailabilityOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#d1d6de] bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <CalendarDays className="size-3.5" />
                        Открыть занятость
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {WEEKDAYS_ORDER.map((day) => {
                          const active = availability?.workingDays.includes(day);
                          return (
                            <span
                              key={day}
                              className={cx(
                                'inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-semibold',
                                active
                                  ? 'bg-navy-700 text-white'
                                  : 'bg-[#f3f4f6] text-[#9ca3af]',
                              )}
                            >
                              {WEEKDAY_SHORT_LABELS[day]}
                            </span>
                          );
                        })}
                      </div>
                      {workHoursRange && (
                        <span className="text-sm font-medium text-[#1a1f36]">{workHoursRange}</span>
                      )}
                      {availability && !availability.exists && (
                        <span className="text-sm text-[#9ca3af]">График не задан</span>
                      )}
                    </div>
                  </div>
                </div>
              </ProfileCard>

              <ProfileCard className="flex flex-col gap-4">
                <ProfileCardTitle
                  action={
                    <ProfileLinkAction onClick={() => setAssignOpen(true)}>
                      + Назначить класс
                    </ProfileLinkAction>
                  }
                >
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span>Назначенные классы</span>
                    <span className="text-sm font-normal text-[#9ca3af]">
                      Всего классов: {assignedClassIds.length}
                    </span>
                  </span>
                </ProfileCardTitle>

                {detail.assignments.length === 0 ? (
                  <EmptyBlock title="Классы не назначены" description="Назначьте предмет и класс учителю." />
                ) : (
                  <ul>
                    {detail.assignments.map((a) => (
                      <li
                        key={a.id}
                        className="group flex items-center justify-between gap-4 border-b border-[#f3f4f6] py-3 text-[13px] last:border-b-0"
                      >
                        <span className="font-semibold text-[#1a1f36]">{a.className} класс</span>
                        <div className="flex items-center gap-6">
                          <span className="text-[#6b7280]">{a.schoolSubjectName}</span>
                          <span className="text-[#9ca3af]">
                            {a.studentCount}{' '}
                            {pluralRu(a.studentCount, ['ученик', 'ученика', 'учеников'])}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleRemoveAssignment(a.id)}
                            title="Снять назначение"
                            className="rounded-lg p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </ProfileCard>
            </div>

            <div className="flex flex-col gap-6">
              <ProfileCard className="flex h-fit flex-col gap-5">
                <ProfileCardTitle>Сводка</ProfileCardTitle>
                <div className="flex flex-col gap-4">
                  <ProfileInfoField
                    label="Статус"
                    value={<ProfileStatusBadge status={detail.accountStatus} />}
                  />
                  <ProfileInfoField label="Предметов" value={`${subjects.length}`} />
                  <ProfileInfoField label="Классов" value={`${assignedClassIds.length}`} />
                  <ProfileInfoField label="Учеников всего" value={`${totalStudents}`} />
                  <ProfileInfoField label="Дата создания" value={formatDate(detail.createdAt)} />
                  <ProfileInfoField
                    label="Последняя активность"
                    value={detail.lastLoginAt ? formatDate(detail.lastLoginAt) : '—'}
                  />
                </div>
              </ProfileCard>

              <ProfileCard className="flex h-fit flex-col gap-4">
                <div>
                  <h2 className="text-base font-bold text-[#1a1f36]">Расписание на сегодня</h2>
                  <p className="mt-0.5 text-sm text-[#9ca3af]">{formatWeekdayDayMonth()}</p>
                </div>
                {todayLessons.length === 0 ? (
                  <p className="text-sm text-[#9ca3af]">Уроков нет</p>
                ) : (
                  <ul>
                    {todayLessons.map((l) => (
                      <li
                        key={l.lessonId}
                        className="flex items-center justify-between gap-3 border-b border-[#f3f4f6] py-3 last:border-b-0"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-navy-700">
                            {l.startTime.slice(0, 5)}–{l.endTime.slice(0, 5)}
                          </span>
                          <span className="truncate text-sm font-medium text-[#1a1f36]">
                            {l.subjectName}
                          </span>
                        </div>
                        <span className="shrink-0 rounded-md bg-[rgba(251,146,60,0.08)] px-2.5 py-1 text-xs font-semibold text-brand-500">
                          {l.className}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </ProfileCard>
            </div>
          </div>

          <CreateAssignmentModal
            open={assignOpen}
            onClose={() => setAssignOpen(false)}
            teacher={detail}
            onSaved={() => void reload()}
          />
          <Modal
            open={availabilityOpen}
            onClose={() => setAvailabilityOpen(false)}
            title="Занятость учителя"
            size="xl"
          >
            <TeacherAvailabilityCard
              teacherId={detail.id}
              teacher={detail}
              onClose={() => setAvailabilityOpen(false)}
            />
          </Modal>
          <ConfirmDialog
            open={archiveOpen}
            onClose={() => setArchiveOpen(false)}
            onConfirm={() => void handleArchive()}
            title="Перевести в архив?"
            confirmLabel="В архив"
            danger
            message={
              <>
                Учитель <b>«{name}»</b> и его аккаунт будут архивированы. Вход станет недоступен.
              </>
            }
          />
        </>
      )}
    </div>
  );
}
