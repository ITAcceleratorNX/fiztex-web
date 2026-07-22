import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { formatDate, initials, pluralRu } from '@/lib/format';
import { ACCOUNT_STATUS_LABELS } from '../labels';
import { AccountActionsMenu } from '../components/AccountActionsMenu';
import {
  IconActionButton,
  ProfileBreadcrumb,
  ProfileCard,
  ProfileCardTitle,
  ProfileEditButton,
  ProfileInfoField,
  ProfileLinkAction,
  ProfileStatusBadge,
  SoftBadge,
} from '../components/ProfileChrome';
import { LinkStudentModal } from '../modals/LinkStudentModal';
import {
  archiveUser,
  blockUser,
  getParentByAccount,
  resetAccess,
  unblockUser,
  updateParent,
} from '../services';
import type { AccountStatus, ParentProfileDetail } from '../types';
import { formatPersonName } from '../types';

const CHILD_AVATAR_COLORS = ['#274185', '#059669', '#6b7280', '#4f46e5', '#d97706'];

function formatClassLabel(className: string | null | undefined): string | null {
  if (!className) return null;
  const trimmed = className.trim();
  const quoted = trimmed.match(/^(\d+)\s*[«"']\s*([A-Za-zА-Яа-яЁё])\s*[»"']/);
  if (quoted) return `${quoted[1]} «${quoted[2].toUpperCase()}» класс`;
  const plain = trimmed.match(/^(\d+)\s*([A-Za-zА-Яа-яЁё])(?:\s*класс)?$/i);
  if (plain) return `${plain[1]} «${plain[2].toUpperCase()}» класс`;
  if (/класс/i.test(trimmed)) return trimmed;
  return `${trimmed} класс`;
}

function ChildStatusBadge({ status }: { status: AccountStatus }) {
  if (status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#ecfdf5] px-2 py-0.5 text-xs font-semibold text-[#059669]">
        <span className="size-1.5 rounded-full bg-[#10b981]" />
        Активен
      </span>
    );
  }
  if (status === 'BLOCKED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#fee2e2] px-2 py-0.5 text-xs font-semibold text-[#dc2626]">
        <span className="size-1.5 rounded-full bg-[#ef4444]" />
        Заблокирован
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
      <span className="size-1.5 rounded-full bg-slate-400" />
      {ACCOUNT_STATUS_LABELS[status]}
    </span>
  );
}

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

  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  const [linkOpen, setLinkOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
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

  async function handleResetAccess() {
    try {
      const res = await resetAccess(String(accountId), 'PARENT');
      setIssuedCode(res.issuedCode ?? null);
      toast.success('Новый код активации выпущен');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сбросить доступ');
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
    <div className="flex flex-col gap-8">
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
          <div className="flex flex-col gap-3">
            <ProfileBreadcrumb
              items={[
                { label: 'Пользователи', to: '/admin/users' },
                { label: 'Родители', to: '/parents' },
                { label: name },
              ]}
            />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <h1 className="text-[28px] font-bold leading-none text-[#1a1f36]">{name}</h1>
                <ProfileStatusBadge status={detail.accountStatus} />
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
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex flex-col gap-6">
              <ProfileCard className="flex flex-col gap-5">
                <ProfileCardTitle>Основная информация</ProfileCardTitle>

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
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <ProfileInfoField label="ФИО родителя" value={name} />
                      <ProfileInfoField label="Email" value={detail.email ?? '—'} />
                    </div>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <ProfileInfoField label="Телефон" value={detail.phone} />
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <p className="text-[11px] font-semibold uppercase text-[#9ca3af]">
                          Код активации
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-navy-700">
                            {issuedCode ?? '—'}
                          </span>
                          {issuedCode && (
                            <IconActionButton title="Скопировать" onClick={() => void handleCopyCode()}>
                              <Copy className="size-3" />
                            </IconActionButton>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <ProfileInfoField
                        label="Статус активации"
                        value={
                          detail.accountStatus === 'ACTIVE' ? (
                            <SoftBadge tone="green">Аккаунт активирован</SoftBadge>
                          ) : (
                            <SoftBadge tone="gray">
                              {ACCOUNT_STATUS_LABELS[detail.accountStatus]}
                            </SoftBadge>
                          )
                        }
                      />
                    </div>
                  </div>
                )}
              </ProfileCard>

              <ProfileCard className="flex flex-col gap-4">
                <ProfileCardTitle
                  action={
                    <ProfileLinkAction onClick={() => setLinkOpen(true)}>
                      + Привязать ученика
                    </ProfileLinkAction>
                  }
                >
                  Связанные ученики
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
                      const classLabel = formatClassLabel(s.className);
                      const avatarBg = CHILD_AVATAR_COLORS[index % CHILD_AVATAR_COLORS.length];
                      return (
                        <li
                          key={s.studentProfileId}
                          className="flex items-center gap-4 border-b border-[#f3f4f6] py-3 last:border-b-0"
                        >
                          <span
                            className="inline-flex size-10 shrink-0 items-center justify-center rounded-[20px] text-sm font-bold text-white"
                            style={{ backgroundColor: avatarBg }}
                          >
                            {initials(studentName)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-[#1a1f36]">
                                {studentName}
                              </p>
                              {classLabel && <SoftBadge tone="blue">{classLabel}</SoftBadge>}
                            </div>
                            {s.academicYearName && (
                              <p className="mt-0.5 text-xs text-[#9ca3af]">
                                Учебный год: {s.academicYearName}
                              </p>
                            )}
                          </div>
                          <ChildStatusBadge status={s.accountStatus} />
                          <button
                            type="button"
                            onClick={() => navigate(`/students/${s.accountId}`)}
                            title="Открыть профиль ученика"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="size-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ProfileCard>
            </div>

            <ProfileCard className="flex h-fit flex-col gap-5">
              <ProfileCardTitle>Сводка</ProfileCardTitle>
              <div className="flex flex-col gap-4">
                <ProfileInfoField
                  label="Статус"
                  value={<ProfileStatusBadge status={detail.accountStatus} />}
                />
                <ProfileInfoField
                  label="Привязанные дети"
                  value={`${detail.linkedStudents.length} ${pluralRu(detail.linkedStudents.length, ['ученик', 'ученика', 'учеников'])}`}
                />
                <ProfileInfoField label="Дата создания" value={formatDate(detail.createdAt)} />
                <ProfileInfoField
                  label="Последняя активность"
                  value={detail.lastLoginAt ? formatDate(detail.lastLoginAt) : '—'}
                />
              </div>
            </ProfileCard>
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
