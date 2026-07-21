import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Copy, Pencil, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Field, TextInput } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { formatDate, formatDateTime } from '@/lib/format';
import { ACCOUNT_STATUS_LABELS, PARENT_RELATION_LABELS, ROLE_AVATAR_COLOR, SCHOOL_STATUS_LABELS } from '../labels';
import { AccountActionsMenu } from '../components/AccountActionsMenu';
import { AddToClassModal } from '../modals/AddToClassModal';
import { LinkParentModal } from '../modals/LinkParentModal';
import {
  archiveUser,
  blockUser,
  getStudentByAccount,
  listClasses,
  reissueCode,
  unblockUser,
  unlinkStudent,
  updateStudent,
} from '../services';
import type { SchoolClass, StudentProfileDetail } from '../types';
import { formatPersonName } from '../types';

function InfoField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

export function StudentProfilePage() {
  const { accountId: accountIdParam } = useParams();
  const accountId = Number(accountIdParam);
  const navigate = useNavigate();
  const toast = useToast();

  const [detail, setDetail] = useState<StudentProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [editing, setEditing] = useState(false);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);

  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [reissuing, setReissuing] = useState(false);

  const [addToClassOpen, setAddToClassOpen] = useState(false);
  const [linkParentOpen, setLinkParentOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, c] = await Promise.all([getStudentByAccount(accountId), listClasses()]);
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
      await updateStudent(detail.id, { lastName, firstName, middleName: middleName || null, birthDate: birthDate || null });
      toast.success('Профиль обновлён');
      setEditing(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  async function handleReissue() {
    setReissuing(true);
    try {
      const res = await reissueCode(String(accountId));
      setIssuedCode(res.issuedCode ?? null);
      toast.success('Новый персональный код выпущен');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось перевыпустить код');
    } finally {
      setReissuing(false);
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

  async function handleUnlinkParent(parentProfileId: number) {
    if (!detail) return;
    if (!window.confirm('Отвязать родителя?')) return;
    try {
      await unlinkStudent(parentProfileId, detail.id);
      toast.success('Родитель отвязан');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось отвязать');
    }
  }

  if (!Number.isFinite(accountId)) {
    return <ErrorBlock message="Некорректный идентификатор ученика." />;
  }

  const name = detail ? formatPersonName(detail.lastName, detail.firstName, detail.middleName) : '';

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5 text-sm text-slate-400">
        <Link to="/admin/users" className="font-medium hover:text-brand-600">
          Пользователи
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/students" className="font-medium hover:text-brand-600">
          Ученики
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-600">{name || '…'}</span>
      </div>

      {loading ? (
        <div className="card">
          <LoadingBlock label="Загрузка ученика…" />
        </div>
      ) : error || !detail ? (
        <div className="card">
          <ErrorBlock message={error ?? 'Ученик не найден'} onRetry={() => void reload()} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={name} size="lg" color={ROLE_AVATAR_COLOR.STUDENT} />
              <div>
                <h1 className="flex items-center gap-2.5 text-[28px] font-extrabold leading-tight tracking-tight text-slate-900">
                  {name}
                  {detail.accountStatus === 'ACTIVE' ? (
                    <Badge tone="green" dot>Активен</Badge>
                  ) : (
                    <Badge tone="gray" dot>{ACCOUNT_STATUS_LABELS[detail.accountStatus]}</Badge>
                  )}
                </h1>
              </div>
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
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="card space-y-5 px-6 py-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Основная информация</h2>
              </div>

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
                  <Field label="Дата рождения">
                    <TextInput type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                  </Field>
                  <div className="flex items-end gap-2">
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
                  <InfoField label="ФИО ученика" value={name} />
                  <InfoField label="Учебный год" value={detail.currentMembership?.academicYearName ?? '—'} />
                  <InfoField label="Класс поступления" value={detail.currentMembership?.className ?? 'Не назначен'} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Персональный код</p>
                    <div className="mt-1 flex items-center gap-2">
                      {issuedCode ? (
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(issuedCode);
                            toast.success('Код скопирован');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                        >
                          {issuedCode}
                          <Copy className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                      ) : (
                        <span className="text-sm text-slate-400">Скрыт</span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleReissue()}
                        disabled={reissuing}
                        title="Перевыпустить код"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">Связанные родители</h2>
                  <button
                    type="button"
                    onClick={() => setLinkParentOpen(true)}
                    className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    + Привязать родителя
                  </button>
                </div>
                {detail.linkedParents.length === 0 ? (
                  <EmptyBlock title="Родители не привязаны" description="Привяжите родителя, чтобы он видел данные ученика." />
                ) : (
                  <ul className="divide-y divide-slate-50 rounded-xl ring-1 ring-slate-200">
                    {detail.linkedParents.map((p) => (
                      <li key={p.parentProfileId} className="flex items-center gap-3 px-4 py-3">
                        <Avatar
                          name={formatPersonName(p.lastName, p.firstName, p.middleName)}
                          size="sm"
                          color={ROLE_AVATAR_COLOR.PARENT}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {formatPersonName(p.lastName, p.firstName, p.middleName)}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {p.phone} · {PARENT_RELATION_LABELS[p.relationType]}
                          </p>
                        </div>
                        <button
                          onClick={() => void handleUnlinkParent(p.parentProfileId)}
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

              {detail.membershipHistory.length > 0 && (
                <div className="border-t border-slate-100 pt-5">
                  <h2 className="mb-3 text-base font-bold text-slate-900">История классов</h2>
                  <ul className="divide-y divide-slate-50 rounded-xl ring-1 ring-slate-200">
                    {detail.membershipHistory.map((m) => (
                      <li key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="font-medium text-slate-700">
                          {m.className} · {m.academicYearName}
                        </span>
                        <span className="text-slate-400">{SCHOOL_STATUS_LABELS[m.status]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
              <InfoField label="Персональный код" value={issuedCode ?? 'Скрыт'} />
              <InfoField label="Дата создания" value={formatDate(detail.createdAt)} />
              <InfoField label="Последняя активность" value={formatDateTime(detail.updatedAt)} />
              <Button variant="secondary" className="w-full" onClick={() => setAddToClassOpen(true)}>
                Добавить в класс
              </Button>
            </div>
          </div>

          <AddToClassModal
            open={addToClassOpen}
            onClose={() => setAddToClassOpen(false)}
            student={detail}
            classes={classes}
            onSaved={() => void reload()}
          />
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
