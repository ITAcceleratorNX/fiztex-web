import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Pencil, Plus, X } from 'lucide-react';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { cx, formatDate, formatDateTime } from '@/lib/format';
import {
  ACCOUNT_STATUS_LABELS,
  ROLE_AVATAR_COLOR,
  WEEKDAYS_ORDER,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT_LABELS,
} from '../labels';
import { AccountActionsMenu } from '../components/AccountActionsMenu';
import { CreateAssignmentModal } from '../modals/CreateAssignmentModal';
import {
  archiveTeacherAssignment,
  archiveTeacherWorkingTime,
  archiveUser,
  blockUser,
  createTeacherWorkingTime,
  getTeacherByAccount,
  listClasses,
  listTeacherWorkingTime,
  resetAccess,
  unblockUser,
  updateTeacher,
  type TeacherWorkingTime,
} from '../services';
import type { SchoolClass, TeacherProfileDetail } from '../types';
import { formatPersonName } from '../types';

function InfoField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

export function TeacherProfilePage() {
  const { accountId: accountIdParam } = useParams();
  const accountId = Number(accountIdParam);
  const navigate = useNavigate();
  const toast = useToast();

  const [detail, setDetail] = useState<TeacherProfileDetail | null>(null);
  const [workingTime, setWorkingTime] = useState<TeacherWorkingTime[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
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

  const [wtDay, setWtDay] = useState<Weekday>('MONDAY');
  const [wtStart, setWtStart] = useState('09:00');
  const [wtEnd, setWtEnd] = useState('15:00');
  const [wtPending, setWtPending] = useState(false);
  const [wtFormOpen, setWtFormOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getTeacherByAccount(accountId);
      const [wt, cl] = await Promise.all([listTeacherWorkingTime(d.id), listClasses()]);
      setDetail(d);
      setWorkingTime(wt);
      setClasses(cl);
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

  const subjects = useMemo(
    () => Array.from(new Set(detail?.assignments.map((a) => a.schoolSubjectName) ?? [])),
    [detail],
  );
  const assignedClassIds = useMemo(
    () => Array.from(new Set(detail?.assignments.map((a) => a.classId) ?? [])),
    [detail],
  );
  const totalStudents = useMemo(
    () =>
      assignedClassIds.reduce((sum, classId) => {
        const c = classes.find((cl) => Number(cl.id) === classId);
        return sum + (c?.studentCount ?? 0);
      }, 0),
    [assignedClassIds, classes],
  );
  const activeDays = useMemo(() => new Set(workingTime.map((w) => w.dayOfWeek)), [workingTime]);
  const workHours = workingTime[0] ? `${workingTime[0].startTime}–${workingTime[0].endTime}` : '—';

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

  async function handleAddWorkingTime() {
    if (!detail) return;
    setWtPending(true);
    try {
      await createTeacherWorkingTime(detail.id, {
        dayOfWeek: wtDay,
        startTime: wtStart.length === 5 ? `${wtStart}:00` : wtStart,
        endTime: wtEnd.length === 5 ? `${wtEnd}:00` : wtEnd,
      });
      toast.success('Интервал добавлен');
      setWtFormOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось добавить интервал');
    } finally {
      setWtPending(false);
    }
  }

  async function handleRemoveWorkingTime(id: number) {
    try {
      await archiveTeacherWorkingTime(id);
      toast.success('Интервал удалён');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось удалить интервал');
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
    <div>
      <div className="mb-3 flex items-center gap-1.5 text-sm text-slate-400">
        <Link to="/admin/users" className="font-medium hover:text-brand-600">
          Пользователи
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/teachers" className="font-medium hover:text-brand-600">
          Учителя
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-600">{name || '…'}</span>
      </div>

      {loading ? (
        <div className="card">
          <LoadingBlock label="Загрузка учителя…" />
        </div>
      ) : error || !detail ? (
        <div className="card">
          <ErrorBlock message={error ?? 'Учитель не найден'} onRetry={() => void reload()} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={name} size="lg" color={ROLE_AVATAR_COLOR.TEACHER} />
              <h1 className="flex items-center gap-2.5 text-[28px] font-extrabold leading-tight tracking-tight text-slate-900">
                {name}
                {detail.accountStatus === 'ACTIVE' ? (
                  <Badge tone="green" dot>Активен</Badge>
                ) : (
                  <Badge tone="gray" dot>{ACCOUNT_STATUS_LABELS[detail.accountStatus]}</Badge>
                )}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing((v) => !v)}>
                Редактировать
              </Button>
              <AccountActionsMenu
                status={detail.accountStatus}
                onBlock={() => void handleBlock()}
                onUnblock={() => void handleUnblock()}
                onArchive={() => setArchiveOpen(true)}
                onResetAccess={() => void handleResetAccess()}
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="card space-y-5 px-6 py-6 lg:col-span-2">
              {editing ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <InfoField label="Роль" value="Учитель" />
                  <InfoField label="Телефон" value={detail.phone} />
                  {issuedCode && <InfoField label="Код активации" value={issuedCode} />}
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Предметы</p>
                {subjects.length === 0 ? (
                  <p className="text-sm text-slate-400">Нет назначений</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {subjects.map((s) => (
                      <Badge key={s} tone="blue">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Классы</p>
                {assignedClassIds.length === 0 ? (
                  <p className="text-sm text-slate-400">Нет назначений</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.assignments
                      .filter((a, i, arr) => arr.findIndex((x) => x.classId === a.classId) === i)
                      .map((a) => (
                        <Badge key={a.classId} tone="amber">{a.className}</Badge>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Рабочие дни и часы</p>
                  <button
                    type="button"
                    onClick={() => setWtFormOpen((v) => !v)}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    {wtFormOpen ? 'Скрыть' : 'Изменить'}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {WEEKDAYS_ORDER.map((day) => (
                    <span
                      key={day}
                      className={cx(
                        'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold',
                        activeDays.has(day) ? 'bg-navy-700 text-white' : 'bg-slate-100 text-slate-400',
                      )}
                    >
                      {WEEKDAY_SHORT_LABELS[day]}
                    </span>
                  ))}
                  <span className="ml-2 text-sm text-slate-600">{workHours}</span>
                </div>

                {wtFormOpen && (
                  <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                    {workingTime.length > 0 && (
                      <ul className="space-y-1">
                        {workingTime.map((w) => (
                          <li key={w.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-slate-200">
                            <span>
                              {WEEKDAY_LABELS[w.dayOfWeek as Weekday] ?? w.dayOfWeek}: {w.startTime.slice(0, 5)}–{w.endTime.slice(0, 5)}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleRemoveWorkingTime(w.id)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap items-end gap-2">
                      <Select className="w-auto" value={wtDay} onChange={(e) => setWtDay(e.target.value as Weekday)}>
                        {WEEKDAYS_ORDER.map((d) => (
                          <option key={d} value={d}>
                            {WEEKDAY_LABELS[d]}
                          </option>
                        ))}
                      </Select>
                      <TextInput type="time" className="w-auto" value={wtStart} onChange={(e) => setWtStart(e.target.value)} />
                      <TextInput type="time" className="w-auto" value={wtEnd} onChange={(e) => setWtEnd(e.target.value)} />
                      <Button size="sm" icon={<Plus className="h-4 w-4" />} loading={wtPending} onClick={() => void handleAddWorkingTime()}>
                        Добавить
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">
                    Назначенные классы <span className="text-sm font-normal text-slate-400">Всего: {assignedClassIds.length}</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setAssignOpen(true)}
                    className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    + Назначить класс
                  </button>
                </div>
                {detail.assignments.length === 0 ? (
                  <EmptyBlock title="Классы не назначены" description="Назначьте предмет и класс учителю." />
                ) : (
                  <ul className="divide-y divide-slate-50 rounded-xl ring-1 ring-slate-200">
                    {detail.assignments.map((a) => {
                      const cl = classes.find((c) => Number(c.id) === a.classId);
                      return (
                        <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                          <span className="font-semibold text-slate-800">{a.className}</span>
                          <span className="text-slate-500">{a.schoolSubjectName}</span>
                          <span className="text-slate-400">
                            {cl ? `${cl.studentCount} учеников` : '—'}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleRemoveAssignment(a.id)}
                            title="Снять назначение"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="card space-y-4 px-6 py-6">
              <h2 className="text-base font-bold text-slate-900">Сводка</h2>
              <InfoField
                label="Статус"
                value={
                  detail.accountStatus === 'ACTIVE' ? (
                    <Badge tone="green" dot>Активен</Badge>
                  ) : (
                    <Badge tone="gray" dot>{ACCOUNT_STATUS_LABELS[detail.accountStatus]}</Badge>
                  )
                }
              />
              <InfoField label="Предметов" value={`${subjects.length}`} />
              <InfoField label="Классов" value={`${assignedClassIds.length}`} />
              <InfoField label="Учеников всего" value={`${totalStudents}`} />
              <InfoField
                label="Рабочий график"
                value={activeDays.size > 0 ? `${Array.from(activeDays).map((d) => WEEKDAY_SHORT_LABELS[d as keyof typeof WEEKDAY_SHORT_LABELS]).join(', ')}, ${workHours}` : '—'}
              />
              <InfoField label="Дата создания" value={formatDate(detail.createdAt)} />
              <InfoField label="Последняя активность" value={formatDateTime(detail.updatedAt)} />
            </div>
          </div>

          <CreateAssignmentModal
            open={assignOpen}
            onClose={() => setAssignOpen(false)}
            teacher={detail}
            onSaved={() => void reload()}
          />
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
