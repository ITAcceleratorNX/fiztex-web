import { useStudentYearDecisions } from '@/hooks/queries';
import type { Schema } from '@/lib/apiSchemas';
import { StudentYearDecisionHistory } from '../components/StudentYearDecisionHistory';
import { StudentYearDecisionCancellationModal } from '../modals/StudentYearDecisionCancellationModal';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Pencil } from 'lucide-react';
import { Avatar, AVATAR_SEQUENCE } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { formatDate, pluralRu } from '@/lib/format';
import { PARENT_RELATION_LABELS, SCHOOL_STATUS_LABELS } from '../labels';
import { AccountActionsMenu } from '../components/AccountActionsMenu';
import {
  ProfileBreadcrumb,
  ProfileCard,
  ProfileCardTitle,
  ProfileEditButton,
  ProfileHeaderCard,
  ProfileLinkAction,
} from '../components/ProfileChrome';
import { StudentAccessCard } from '../components/AccessRecoveryCards';
import { UnlinkRelationButton } from '../components/UnlinkRelationButton';
import { AddToClassModal } from '../modals/AddToClassModal';
import { LinkParentModal } from '../modals/LinkParentModal';
import {
  archiveUser,
  blockUser,
  getStudentByAccount,
  listClasses,
  unblockUser,
  updateStudent,
} from '../services';
import type { ClassMembership, SchoolClass, StudentProfileDetail } from '../types';
import { formatPersonName } from '../types';

export function StudentProfilePage() {
  const { accountId: accountIdParam } = useParams();
  const accountId = Number(accountIdParam);
  const navigate = useNavigate();
  const toast = useToast();

  const [detail, setDetail] = useState<StudentProfileDetail | null>(null);
  const decisions = useStudentYearDecisions(detail ? String(detail.id) : null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [editing, setEditing] = useState(false);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);

  const [addToClassOpen, setAddToClassOpen] = useState(false);
  const [linkParentOpen, setLinkParentOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [cancelling, setCancelling] = useState<Schema<'StudentYearDecision'> | null>(null);

  // `silent` — перечитать данные, не подменяя страницу скелетом: иначе карточка доступа
  // размонтируется вместе с открытым окном выданного кода, а показать его второй раз
  // нечем. Обычная загрузка (вход на страницу, смена ученика) по-прежнему со скелетом.
  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [d, c] = await Promise.all([
        getStudentByAccount(accountId),
        listClasses({ status: 'ACTIVE' }),
      ]);
      setDetail(d);
      setClasses(c);
      setLastName(d.lastName);
      setFirstName(d.firstName);
      setMiddleName(d.middleName ?? '');
      setBirthDate(d.birthDate ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить ученика');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (Number.isFinite(accountId)) void reload();
  }, [accountId, reload]);

  async function handleSave() {
    if (!detail) return;
    setSaving(true);
    try {
      await updateStudent(detail.id, {
        lastName,
        firstName,
        middleName: middleName || null,
        birthDate: birthDate || null,
      });
      toast.success('Профиль обновлён');
      setEditing(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
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
      toast.success('Ученик переведён в архив');
      navigate('/students', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось перевести в архив');
      setArchiveOpen(false);
    }
  }

  if (!Number.isFinite(accountId)) {
    return <ErrorBlock message="Некорректный идентификатор ученика." />;
  }

  const name = detail ? formatPersonName(detail.lastName, detail.firstName, detail.middleName) : '';

  return (
    <div className="flex flex-col gap-6">
      {loading ? (
        <ProfileCard>
          <LoadingBlock label="Загрузка ученика…" />
        </ProfileCard>
      ) : error || !detail ? (
        <ProfileCard>
          <ErrorBlock message={error ?? 'Ученик не найден'} onRetry={() => void reload()} />
        </ProfileCard>
      ) : (
        <>
          <ProfileBreadcrumb
            items={[
              { label: 'Пользователи', to: '/admin/users' },
              { label: 'Ученики', to: '/students' },
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
                />
              </>
            }
            fields={[
              {
                label: 'Класс',
                value: detail.currentMembership ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge appearance="tag" tone="amber" size="base">{detail.currentMembership.className}</Badge>
                    <ProfileLinkAction onClick={() => setAddToClassOpen(true)}>Изменить</ProfileLinkAction>
                  </span>
                ) : (
                  <ProfileLinkAction onClick={() => setAddToClassOpen(true)}>Назначить класс</ProfileLinkAction>
                ),
              },
              { label: 'Дата рождения', value: formatDate(detail.birthDate) },
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
                <Field label="Дата рождения">
                  <TextInput type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
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
                    <ProfileLinkAction onClick={() => setLinkParentOpen(true)}>
                      + Привязать родителя
                    </ProfileLinkAction>
                  }
                >
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span>Родители</span>
                    {detail.linkedParents.length > 0 && (
                      <span className="text-sm font-normal text-subtle">
                        {detail.linkedParents.length} {pluralRu(detail.linkedParents.length, ['родитель', 'родителя', 'родителей'])}
                      </span>
                    )}
                  </span>
                </ProfileCardTitle>

                {detail.linkedParents.length === 0 ? (
                  <EmptyBlock
                    title="Родители не привязаны"
                    description="Привяжите родителя, чтобы он видел данные ученика."
                  />
                ) : (
                  <ul>
                    {detail.linkedParents.map((p, index) => {
                      const parentName = formatPersonName(p.lastName, p.firstName, p.middleName);
                      return (
                        <li
                          key={p.parentProfileId}
                          className="flex items-center gap-4 border-b border-neutral-bg py-3 last:border-b-0"
                        >
                          <Avatar name={parentName} variant={AVATAR_SEQUENCE[index % AVATAR_SEQUENCE.length]} />
                          <div className="min-w-0 flex-1">
                            <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                              <span className="truncate text-sm font-semibold text-ink">{parentName}</span>
                              <span className="text-xs font-medium text-muted">{PARENT_RELATION_LABELS[p.relationType]}</span>
                            </p>
                            <p className="truncate text-xs text-subtle">
                              {p.phone}
                              {p.email ? ` · ${p.email}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigate(`/parents/${p.accountId}`)}
                            title="Открыть профиль родителя"
                            aria-label={`Открыть профиль родителя ${parentName}`}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="size-4" aria-hidden />
                          </button>
                          <UnlinkRelationButton
                            side="student"
                            parentProfileId={p.parentProfileId}
                            studentProfileId={detail.id}
                            parentName={parentName}
                            studentName={name}
                            onUnlinked={() => void reload(true)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ProfileCard>

              <ProfileCard className="flex flex-col gap-3">
                <ProfileCardTitle>История классов</ProfileCardTitle>
                {detail.membershipHistory.length > 0 && (
                  <ul>
                    {detail.membershipHistory.map((m) => {
                      const current = m.id === detail.currentMembership?.id;
                      return (
                        <li
                          key={m.id}
                          title={membershipPeriod(m) || undefined}
                          className="flex items-center justify-between gap-3 border-b border-neutral-bg py-2.5 last:border-b-0"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <Badge appearance="tag" tone={current ? 'amber' : 'gray'} size="base">{m.className}</Badge>
                            <span className="text-13 text-ink">{m.academicYearName}</span>
                          </span>
                          {current
                            ? <Badge tone="green" dot>Текущий</Badge>
                            : <span className="text-13 text-subtle">{membershipStatus(m)}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {decisions.isPending ? (
                  <LoadingBlock label="Загрузка решений…" />
                ) : decisions.isError ? (
                  <ErrorBlock message="Не удалось загрузить историю перевода и выпуска" onRetry={() => void decisions.refetch()} />
                ) : (decisions.data?.length ?? 0) > 0 ? (
                  <div className="flex flex-col gap-3 border-t border-neutral-bg pt-4">
                    <p className="text-sm font-semibold text-ink">Перевод и выпуск</p>
                    <StudentYearDecisionHistory decisions={decisions.data ?? []} onCancel={setCancelling} />
                  </div>
                ) : (
                  <p className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-13 text-muted">
                    <ArrowRight className="size-4 shrink-0" aria-hidden />
                    Перевод и выпуск: решения ещё не оформлены
                  </p>
                )}
              </ProfileCard>
            </div>

            {/* Доступ — отдельной карточкой справа: это действия, а не сведения. */}
            <StudentAccessCard
              accountId={accountId}
              pinSet={Boolean(detail.pinSet)}
              onChanged={() => void reload(true)}
            />
          </div>

          <AddToClassModal
            open={addToClassOpen}
            onClose={() => setAddToClassOpen(false)}
            student={detail}
            classes={classes}
            currentMembership={detail.currentMembership}
            onSaved={() => void reload()}
          />
          {cancelling && <StudentYearDecisionCancellationModal decision={cancelling} onClose={() => setCancelling(null)}
            onSaved={() => { void reload(); void decisions.refetch(); }} />}
          <LinkParentModal
            open={linkParentOpen}
            onClose={() => setLinkParentOpen(false)}
            student={detail}
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
                Ученик <b>«{name}»</b> и его аккаунт будут архивированы. Вход станет недоступен.
              </>
            }
          />
        </>
      )}
    </div>
  );
}

/** Состояние строки истории классов — те же правила, что были у карточки до 26.11. */
function membershipStatus(m: ClassMembership): string {
  if (m.voided) return 'Отменено';
  if (m.status === 'ACTIVE' && m.effectiveFrom && m.effectiveFrom > new Date().toLocaleDateString('en-CA')) return 'Запланирован';
  if (m.status === 'ACTIVE' && m.academicYearStatus === 'DRAFT') return 'В составе учебного года';
  return SCHOOL_STATUS_LABELS[m.status];
}

/** «с 1 сент. 2025 до 15 мар. 2026» — подсказка строки: в макете дат нет, но перевод посреди года должен читаться. */
function membershipPeriod(m: ClassMembership): string {
  return [m.effectiveFrom ? `с ${formatDate(m.effectiveFrom)}` : null, m.effectiveTo ? `до ${formatDate(m.effectiveTo)}` : null]
    .filter(Boolean)
    .join(' ');
}
