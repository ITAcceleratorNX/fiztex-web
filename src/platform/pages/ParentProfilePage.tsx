import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { CopyCode } from '@/components/ui/CopyCode';
import { Field, TextInput } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { formatDate, formatDateTime } from '@/lib/format';
import { ACCOUNT_STATUS_LABELS, PARENT_RELATION_LABELS, ROLE_AVATAR_COLOR } from '../labels';
import { AccountActionsMenu } from '../components/AccountActionsMenu';
import { LinkStudentModal } from '../modals/LinkStudentModal';
import {
  archiveUser,
  blockUser,
  getParentByAccount,
  resetAccess,
  unblockUser,
  unlinkStudent,
  updateParent,
} from '../services';
import type { ParentProfileDetail } from '../types';
import { formatPersonName } from '../types';

function InfoField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
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

  async function handleUnlink(studentProfileId: number) {
    if (!detail) return;
    if (!window.confirm('Отвязать ученика?')) return;
    try {
      await unlinkStudent(detail.id, studentProfileId);
      toast.success('Ученик отвязан');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось отвязать');
    }
  }

  if (!Number.isFinite(accountId)) {
    return <ErrorBlock message="Некорректный идентификатор родителя." />;
  }

  const name = detail ? formatPersonName(detail.lastName, detail.firstName, detail.middleName) : '';

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5 text-sm text-slate-400">
        <Link to="/admin/users" className="font-medium hover:text-brand-600">
          Пользователи
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/parents" className="font-medium hover:text-brand-600">
          Родители
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-600">{name || '…'}</span>
      </div>

      {loading ? (
        <div className="card">
          <LoadingBlock label="Загрузка родителя…" />
        </div>
      ) : error || !detail ? (
        <div className="card">
          <ErrorBlock message={error ?? 'Родитель не найден'} onRetry={() => void reload()} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={name} size="lg" color={ROLE_AVATAR_COLOR.PARENT} />
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
              <h2 className="text-base font-bold text-slate-900">Основная информация</h2>

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
                  <InfoField label="ФИО родителя" value={name} />
                  <InfoField label="Телефон" value={detail.phone} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Код активации</p>
                    <div className="mt-1">
                      <CopyCode code={issuedCode} />
                    </div>
                  </div>
                  <InfoField
                    label="Статус активации"
                    value={
                      detail.accountStatus === 'ACTIVE' ? (
                        <Badge tone="green">Аккаунт активирован</Badge>
                      ) : (
                        <Badge tone="gray">{ACCOUNT_STATUS_LABELS[detail.accountStatus]}</Badge>
                      )
                    }
                  />
                </div>
              )}

              <div className="border-t border-slate-100 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">Связанные ученики</h2>
                  <button
                    type="button"
                    onClick={() => setLinkOpen(true)}
                    className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    + Привязать ученика
                  </button>
                </div>
                {detail.linkedStudents.length === 0 ? (
                  <EmptyBlock title="Дети не привязаны" description="Привяжите ученика к этому родителю." />
                ) : (
                  <ul className="divide-y divide-slate-50 rounded-xl ring-1 ring-slate-200">
                    {detail.linkedStudents.map((s) => (
                      <li key={s.studentProfileId} className="flex items-center gap-3 px-4 py-3">
                        <Avatar
                          name={formatPersonName(s.lastName, s.firstName, s.middleName)}
                          size="sm"
                          color={ROLE_AVATAR_COLOR.STUDENT}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {formatPersonName(s.lastName, s.firstName, s.middleName)}
                          </p>
                          <p className="truncate text-xs text-slate-400">{PARENT_RELATION_LABELS[s.relationType]}</p>
                        </div>
                        <button
                          onClick={() => void handleUnlink(s.studentProfileId)}
                          title="Отвязать"
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
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
              <InfoField label="Привязанные дети" value={`${detail.linkedStudents.length}`} />
              <InfoField label="Дата создания" value={formatDate(detail.createdAt)} />
              <InfoField label="Последняя активность" value={formatDateTime(detail.updatedAt)} />
            </div>
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
