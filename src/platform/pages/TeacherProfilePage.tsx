import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Copy, RotateCw, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CheckCardGroup } from '@/components/ui/CheckCardGroup';
import { Field, TextInput } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { cx, formatDate, formatWeekdayDayMonth, pluralRu } from '@/lib/format';
import { WEEKDAYS_ORDER, WEEKDAY_SHORT_LABELS } from '../labels';
import { AccountActionsMenu } from '../components/AccountActionsMenu';
import {
  ProfileBreadcrumb,
  ProfileCard,
  ProfileCardTitle,
  ProfileEditButton,
  ProfileHeaderCard,
  ProfileLinkAction,
} from '../components/ProfileChrome';
import { TeacherStudyAccessCard } from '../components/studyAccess/TeacherStudyAccessCard';
import { CreateAssignmentModal } from '../modals/CreateAssignmentModal';
import { useTeacherAvailability } from '../hooks/useTeacherAvailability';
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
import type { TeacherAssignment, TeacherProfileDetail, TeacherTodayLesson } from '../types';
import { formatPersonName } from '../types';
import { DemoBadge } from '@/components/ui/DemoBadge';

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
  const [reissuing, setReissuing] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [removing, setRemoving] = useState<TeacherAssignment[] | null>(null);

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
    const intervals = (availability?.intervals ?? []).filter((i) => i.type === 'AVAILABLE');
    if (intervals.length === 0) return null;
    const start = intervals.map((i) => i.startTime).sort()[0];
    const end = intervals.map((i) => i.endTime).sort().at(-1)!;
    return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
  }, [availability]);

  // «Классы и предметы» (Figma `phyztex` А1): строка на класс, предметы плашками в ней.
  const classRows = useMemo(() => {
    const rows = new Map<number, TeacherAssignment[]>();
    detail?.assignments.forEach((a) => rows.set(a.classId, [...(rows.get(a.classId) ?? []), a]));
    return Array.from(rows.values());
  }, [detail]);
  const totalStudents = useMemo(
    () => classRows.reduce((sum, row) => sum + (row[0]?.studentCount ?? 0), 0),
    [classRows],
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
    setReissuing(true);
    try {
      const res = await resetAccess(String(accountId), 'TEACHER');
      setIssuedCode(res.issuedCode ?? null);
      toast.success('Новый код активации выпущен');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сбросить доступ');
    } finally {
      setReissuing(false);
    }
  }

  async function handleCopyCode() {
    if (!issuedCode) return;
    try {
      await navigator.clipboard.writeText(issuedCode);
      toast.success('Код скопирован');
    } catch {
      toast.error('Не удалось скопировать код');
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

  /** Снимает выбранные назначения по одному: первый отказ останавливает, снятое остаётся снятым. */
  async function handleRemoveAssignments(ids: number[]) {
    let removed = 0;
    try {
      for (const id of ids) {
        await archiveTeacherAssignment(id);
        removed += 1;
      }
      toast.success(removed === 1 ? 'Назначение снято' : 'Назначения сняты');
      setRemoving(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось снять назначение');
    } finally {
      if (removed > 0) await reload();
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

          <ProfileHeaderCard
            name={name}
            status={detail.accountStatus}
            actions={
              <>
                <ProfileEditButton onClick={() => setEditing((v) => !v)} />
                <AccountActionsMenu
                  status={detail.accountStatus}
                  onBlock={() => void handleBlock()}
                  onUnblock={() => void handleUnblock()}
                  onArchive={() => setArchiveOpen(true)}
                  onResetAccess={() => void handleResetAccess()}
                />
              </>
            }
            fields={[
              { label: 'Телефон', value: detail.phone },
              { label: 'Email', value: <span className="break-all">{detail.email ?? '—'}</span> },
              {
                label: 'Код активации',
                value: (<span className="flex items-center gap-2">
                    <span className="font-semibold text-navy-700">{issuedCode ?? '—'}</span>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      title="Скопировать"
                      aria-label="Скопировать код активации"
                      disabled={!issuedCode}
                      onClick={() => void handleCopyCode()}
                    >
                      <Copy className="size-3" aria-hidden />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      title="Перевыпустить код"
                      aria-label="Перевыпустить код активации"
                      disabled={reissuing}
                      onClick={() => void handleResetAccess()}
                    >
                      <RotateCw className={cx('size-3', reissuing && 'animate-spin')} aria-hidden />
                    </Button>
                  </span>),
              },
              { label: 'Последний вход', value: detail.lastLoginAt ? formatDate(detail.lastLoginAt) : '—' },
              { label: 'В системе с', value: formatDate(detail.createdAt) },
            ]}
          >
            {editing && (
              <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
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
            )}
          </ProfileHeaderCard>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-teacher-card">
            <div className="flex min-w-0 flex-col gap-6">
              <ProfileCard className="flex flex-col gap-3">
                <ProfileCardTitle
                  action={
                    <ProfileLinkAction onClick={() => setAssignOpen(true)}>
                      + Назначить класс
                    </ProfileLinkAction>
                  }
                >
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span>Классы и предметы</span>
                    <span className="text-sm font-normal text-subtle">
                      {classRows.length} {pluralRu(classRows.length, ['класс', 'класса', 'классов'])}
                      {' · '}
                      {totalStudents} {pluralRu(totalStudents, ['ученик', 'ученика', 'учеников'])}
                    </span>
                  </span>
                </ProfileCardTitle>

                {classRows.length === 0 ? (
                  <EmptyBlock title="Классы не назначены" description="Назначьте предмет и класс учителю." />
                ) : (
                  <ul>
                    {classRows.map((row) => {
                      const first = row[0]!;
                      return (
                        <li
                          key={first.classId}
                          className="flex items-center gap-4 border-b border-neutral-bg py-3 last:border-b-0"
                        >
                          <span className="flex w-12 shrink-0 items-center gap-1">
                            <Badge appearance="tag" tone="amber" size="lg">{first.className}</Badge>
                          </span>
                          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                            {row.map((a) => (
                              <Badge key={a.id} appearance="tag" tone="navy" size="md">{a.schoolSubjectName}</Badge>
                            ))}
                            {first.classDemo && <DemoBadge />}
                          </span>
                          <span className="shrink-0 text-13 text-subtle">
                            {first.studentCount} {pluralRu(first.studentCount, ['ученик', 'ученика', 'учеников'])}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRemoving(row)}
                            title="Снять назначение"
                            aria-label={`Снять назначение ${first.className}`}
                            className="shrink-0 rounded-lg p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <X className="size-4" aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ProfileCard>

              <TeacherStudyAccessCard
                teacherProfileId={detail.id}
                teacherName={name}
                canGrant={detail.accountStatus === 'ACTIVE'}
              />
            </div>

            <ProfileCard className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-base font-bold text-ink">Сегодня</h2>
                <p className="text-sm text-subtle">{formatWeekdayDayMonth()}</p>
              </div>
              {todayLessons.length === 0 ? (
                <p className="text-sm text-subtle">Уроков нет</p>
              ) : (
                <ul>
                  {todayLessons.map((l) => (
                    <li
                      key={l.lessonId}
                      className="flex items-center justify-between gap-3 border-b border-neutral-bg py-2.5 last:border-b-0"
                    >
                      <span className="flex min-w-0 items-center gap-3 text-sm">
                        <span className="shrink-0 font-semibold tabular-nums text-navy-700">
                          {l.startTime.slice(0, 5)}–{l.endTime.slice(0, 5)}
                        </span>
                        <span className="truncate font-medium text-ink">{l.subjectName}</span>
                      </span>
                      <Badge appearance="tag" tone="amber" size="sm">{l.className}</Badge>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col gap-2.5 border-t border-neutral-bg pt-4">
                <div className="flex items-end justify-between gap-2">
                  <p className="text-11 font-semibold uppercase text-subtle">Рабочее время</p>
                  {workHoursRange && <span className="text-sm font-semibold text-ink">{workHoursRange}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {WEEKDAYS_ORDER.map((day) => {
                    const active = availability?.workingDays.includes(day);
                    return (
                      <span
                        key={day}
                        className={cx(
                          'inline-flex items-center justify-center rounded-md px-1.5 py-1 text-xs font-semibold leading-4',
                          active ? 'bg-navy-700 text-white' : 'bg-neutral-bg text-subtle',
                        )}
                      >
                        {WEEKDAY_SHORT_LABELS[day]}
                      </span>
                    );
                  })}
                </div>
                {availability && !availability.exists && (
                  <span className="text-sm text-subtle">График не задан</span>
                )}
                <Link
                  to={`/lesson-schedule/teachers?teacherId=${detail.id}`}
                  className="inline-flex w-fit items-center gap-1.5 text-13 font-semibold text-brand-500 transition hover:text-brand-600"
                >
                  <CalendarDays className="size-3.5" aria-hidden />
                  Открыть занятость
                </Link>
              </div>
            </ProfileCard>
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
          {removing && (
            <RemoveClassDialog
              assignments={removing}
              onClose={() => setRemoving(null)}
              onConfirm={(ids) => handleRemoveAssignments(ids)}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Снятие назначений класса. В строке класса один «✕» (Figma `phyztex` А1), а предметов в ней
 * бывает несколько — поэтому у класса с одним предметом это обычное подтверждение, а у класса
 * с несколькими сначала выбираются предметы: снять только геометрию должно быть можно, как раньше.
 */
function RemoveClassDialog({
  assignments,
  onClose,
  onConfirm,
}: {
  assignments: TeacherAssignment[];
  onClose: () => void;
  onConfirm: (ids: number[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState(() => assignments.map((a) => String(a.id)));
  const [busy, setBusy] = useState(false);
  const className = assignments[0]?.className ?? '';
  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(selected.map(Number));
    } finally {
      setBusy(false);
    }
  };

  if (assignments.length === 1) {
    return (
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={() => void submit()}
        loading={busy}
        danger
        title="Снять назначение?"
        confirmLabel="Снять"
        message={<>Учитель перестанет вести <b>{assignments[0]!.schoolSubjectName}</b> в {className}.</>}
      />
    );
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`Снять назначения ${className}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Отмена</Button>
          <Button variant="danger" loading={busy} disabled={selected.length === 0} onClick={() => void submit()}>
            Снять
          </Button>
        </>
      }
    >
      <Field label="Предметы" hint="Отмеченные предметы учитель перестанет вести в этом классе">
        <CheckCardGroup
          ariaLabel="Предметы"
          values={selected}
          onChange={setSelected}
          options={assignments.map((a) => ({ value: String(a.id), title: a.schoolSubjectName }))}
        />
      </Field>
    </Modal>
  );
}

