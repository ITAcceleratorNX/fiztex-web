import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Avatar, AVATAR_SEQUENCE } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { formatDate, pluralRu } from '@/lib/format';
import { PARENT_RELATION_LABELS } from '../labels';
import { AccountActionsMenu } from '../components/AccountActionsMenu';
import {
  ProfileBreadcrumb,
  ProfileCard,
  ProfileCardTitle,
  ProfileEditButton,
  ProfileHeaderCard,
  ProfileLinkAction,
} from '../components/ProfileChrome';
import { ParentAccessCard } from '../components/AccessRecoveryCards';
import { UnlinkRelationButton } from '../components/UnlinkRelationButton';
import { LinkStudentModal } from '../modals/LinkStudentModal';
import {
  archiveUser,
  blockUser,
  getParentByAccount,
  unblockUser,
  updateParent,
} from '../services';
import type { ParentProfileDetail } from '../types';
import { formatPersonName } from '../types';

export function ParentProfilePage() {
  const { accountId: accountIdParam } = useParams();
  const accountId = Number(accountIdParam);
  const navigate = useNavigate();
  const toast = useToast();

  const [detail, setDetail] = useState<ParentProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const [linkOpen, setLinkOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // `silent` — перечитать данные, не подменяя страницу скелетом: иначе карточка доступа
  // размонтируется вместе с открытым окном выданного кода, а показать его второй раз
  // нечем. Обычная загрузка (вход на страницу, смена родителя) по-прежнему со скелетом.
  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const d = await getParentByAccount(accountId);
      setDetail(d);
      setLastName(d.lastName);
      setFirstName(d.firstName);
      setMiddleName(d.middleName ?? '');
      setPhone(d.phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить родителя');
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
      await updateParent(detail.id, { lastName, firstName, middleName: middleName || null, phone });
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
      toast.success('Родитель переведён в архив');
      navigate('/parents', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось перевести в архив');
      setArchiveOpen(false);
    }
  }

  if (!Number.isFinite(accountId)) {
    return <ErrorBlock message="Некорректный идентификатор родителя." />;
  }

  const name = detail ? formatPersonName(detail.lastName, detail.firstName, detail.middleName) : '';

  return (
    <div className="flex flex-col gap-6">
      {loading ? (
        <ProfileCard>
          <LoadingBlock label="Загрузка родителя…" />
        </ProfileCard>
      ) : error || !detail ? (
        <ProfileCard>
          <ErrorBlock message={error ?? 'Родитель не найден'} onRetry={() => void reload()} />
        </ProfileCard>
      ) : (
        <>
          <ProfileBreadcrumb
            items={[
              { label: 'Пользователи', to: '/admin/users' },
              { label: 'Родители', to: '/parents' },
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
              { label: 'Телефон', value: detail.phone },
              { label: 'Email', value: <span className="break-all">{detail.email ?? '—'}</span> },
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
            <ProfileCard className="flex min-w-0 flex-col gap-3">
              <ProfileCardTitle
                action={
                  <ProfileLinkAction onClick={() => setLinkOpen(true)}>
                    + Привязать ученика
                  </ProfileLinkAction>
                }
              >
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span>Дети</span>
                  {detail.linkedStudents.length > 0 && (
                    <span className="text-sm font-normal text-subtle">
                      {detail.linkedStudents.length} {pluralRu(detail.linkedStudents.length, ['ученик', 'ученика', 'учеников'])}
                    </span>
                  )}
                </span>
              </ProfileCardTitle>

              {detail.linkedStudents.length === 0 ? (
                <EmptyBlock
                  title="Дети не привязаны"
                  description="Привяжите ученика к этому родителю."
                />
              ) : (
                <ul>
                  {detail.linkedStudents.map((s, index) => {
                    const studentName = formatPersonName(s.lastName, s.firstName, s.middleName);
                    // Дети — синим и зелёным, как в макете (2243:30541): родители в соседней карточке
                    // начинаются с оранжевого, и цвет не подсказывает, чья это строка.
                    const variant = AVATAR_SEQUENCE[(index + 2) % AVATAR_SEQUENCE.length];
                    return (
                      <li
                        key={s.studentProfileId}
                        className="flex items-center gap-4 border-b border-neutral-bg py-3 last:border-b-0"
                      >
                        <Avatar name={studentName} variant={variant} />
                        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-ink">{studentName}</span>
                          {s.className && <Badge appearance="tag" tone="amber" size="sm">{s.className}</Badge>}
                          <span className="text-xs font-medium text-muted">{PARENT_RELATION_LABELS[s.relationType]}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => navigate(`/students/${s.accountId}`)}
                          title="Открыть профиль ученика"
                          aria-label={`Открыть профиль ученика ${studentName}`}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil className="size-4" aria-hidden />
                        </button>
                        <UnlinkRelationButton
                          side="parent"
                          parentProfileId={detail.id}
                          studentProfileId={s.studentProfileId}
                          parentName={name}
                          studentName={studentName}
                          onUnlinked={() => void reload(true)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </ProfileCard>

            {/* Доступ — отдельной карточкой справа: код и пароль выдаются один раз. */}
            <ParentAccessCard
              accountId={accountId}
              accountStatus={detail.accountStatus}
              onChanged={() => void reload(true)}
            />
          </div>

          <LinkStudentModal
            open={linkOpen}
            onClose={() => setLinkOpen(false)}
            parent={detail}
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
                Родитель <b>«{name}»</b> и его аккаунт будут архивированы. Вход станет недоступен.
              </>
            }
          />
        </>
      )}
    </div>
  );
}
