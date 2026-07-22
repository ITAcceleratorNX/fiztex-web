import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, Pencil, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { formatDate } from '@/lib/format';
import { ROLE_AVATAR_COLOR, SCHOOL_STATUS_LABELS } from '../labels';
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
import { AddToClassModal } from '../modals/AddToClassModal';
import { LinkParentModal } from '../modals/LinkParentModal';
import {
  archiveUser,
  blockUser,
  getStudentByAccount,
  listClasses,
  reissueCode,
  unblockUser,
  updateStudent,
} from '../services';
import type { SchoolClass, StudentProfileDetail } from '../types';
import { formatPersonName } from '../types';
import { initials } from '@/lib/format';

/** Formats class name to Figma style: `5 «А» класс`. */
function formatEnrollmentClass(className: string | null | undefined): string {
  if (!className) return 'Не назначен';
  const trimmed = className.trim();
  const quoted = trimmed.match(/^(\d+)\s*[«"']\s*([A-Za-zА-Яа-яЁё])\s*[»"']/);
  if (quoted) return `${quoted[1]} «${quoted[2].toUpperCase()}» класс`;
  const plain = trimmed.match(/^(\d+)\s*([A-Za-zА-Яа-яЁё])(?:\s*класс)?$/i);
  if (plain) return `${plain[1]} «${plain[2].toUpperCase()}» класс`;
  if (/класс/i.test(trimmed)) return trimmed;
  return `${trimmed} класс`;
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
  const shortName = detail ? `${detail.firstName} ${detail.lastName}`.trim() : '';

  return (
    <div className="flex flex-col gap-8">
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
          <div className="flex flex-col gap-3">
            <ProfileBreadcrumb
              items={[
                { label: 'Пользователи', to: '/admin/users' },
                { label: 'Ученики', to: '/students' },
                { label: shortName || name },
              ]}
            />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <h1 className="text-[28px] font-bold leading-none text-[#1a1f36]">
                  {shortName || name}
                </h1>
                <ProfileStatusBadge status={detail.accountStatus} />
              </div>
              <div className="flex items-center gap-3">
                <ProfileEditButton onClick={() => setEditing((v) => !v)} />
                <AccountActionsMenu
                  status={detail.accountStatus}
                  onBlock={() => void handleBlock()}
                  onUnblock={() => void handleUnblock()}
                  onArchive={() => setArchiveOpen(true)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex flex-col gap-6">
              <ProfileCard className="flex flex-col gap-5">
                <ProfileCardTitle>Основная информация</ProfileCardTitle>
                <div className="h-px w-full bg-slate-100" />

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
                      <ProfileInfoField label="ФИО ученика" value={name} />
                      <ProfileInfoField
                        label="Учебный год"
                        value={detail.currentMembership?.academicYearName ?? '—'}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <ProfileInfoField
                        label="Класс поступления"
                        value={
                          detail.currentMembership ? (
                            formatEnrollmentClass(detail.currentMembership.className)
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAddToClassOpen(true)}
                              className="font-medium text-brand-500 hover:text-brand-600"
                            >
                              Назначить класс
                            </button>
                          )
                        }
                      />
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <p className="text-[11px] font-semibold uppercase text-[#9ca3af]">
                          Персональный код
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-navy-700">
                            {issuedCode ?? 'Скрыт'}
                          </span>
                          <IconActionButton
                            title="Скопировать"
                            disabled={!issuedCode}
                            onClick={() => void handleCopyCode()}
                          >
                            <Copy className="size-3" />
                          </IconActionButton>
                          <IconActionButton
                            title="Перевыпустить код"
                            disabled={reissuing}
                            onClick={() => void handleReissue()}
                          >
                            <RotateCw className={`size-3.5 ${reissuing ? 'animate-spin' : ''}`} />
                          </IconActionButton>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <ProfileInfoField
                        label="Статус PIN-кода"
                        value={
                          detail.pinSet ? (
                            <SoftBadge tone="green">Создан</SoftBadge>
                          ) : (
                            <SoftBadge tone="gray">Не создан</SoftBadge>
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
                    <ProfileLinkAction onClick={() => setLinkParentOpen(true)}>
                      + Привязать родителя
                    </ProfileLinkAction>
                  }
                >
                  Связанные родители
                </ProfileCardTitle>
                <div className="h-px w-full bg-slate-100" />

                {detail.linkedParents.length === 0 ? (
                  <EmptyBlock
                    title="Родители не привязаны"
                    description="Привяжите родителя, чтобы он видел данные ученика."
                  />
                ) : (
                  <ul>
                    {detail.linkedParents.map((p) => {
                      const parentName = formatPersonName(p.lastName, p.firstName, p.middleName);
                      const color = ROLE_AVATAR_COLOR.PARENT;
                      return (
                        <li
                          key={p.parentProfileId}
                          className="flex items-center gap-4 border-b border-[#f3f4f6] py-3 last:border-b-0"
                        >
                          <span
                            className="inline-flex size-10 shrink-0 items-center justify-center rounded-[20px] text-sm font-bold text-white"
                            style={{ backgroundColor: color.bg }}
                          >
                            {initials(parentName)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#1a1f36]">{parentName}</p>
                            <p className="truncate text-xs text-[#9ca3af]">
                              {p.phone}
                              {p.email ? ` · ${p.email}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigate(`/parents/${p.accountId}`)}
                            title="Открыть профиль родителя"
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

              {detail.membershipHistory.length > 0 && (
                <ProfileCard className="flex flex-col gap-4">
                  <ProfileCardTitle>История классов</ProfileCardTitle>
                  <ul className="divide-y divide-slate-100">
                    {detail.membershipHistory.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between py-2.5 text-sm first:pt-0"
                      >
                        <span className="font-medium text-slate-700">
                          {formatEnrollmentClass(m.className)} · {m.academicYearName}
                        </span>
                        <span className="text-slate-400">{SCHOOL_STATUS_LABELS[m.status]}</span>
                      </li>
                    ))}
                  </ul>
                </ProfileCard>
              )}
            </div>

            <ProfileCard className="flex h-fit flex-col gap-5">
              <ProfileCardTitle>Сводка</ProfileCardTitle>
              <div className="flex flex-col gap-4">
                <ProfileInfoField
                  label="Статус"
                  value={<ProfileStatusBadge status={detail.accountStatus} />}
                />
                <ProfileInfoField label="Персональный код" value={issuedCode ?? 'Скрыт'} />
                <ProfileInfoField
                  label="PIN-код"
                  value={
                    detail.pinSet ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#059669]">
                        <span className="size-1.5 rounded-full bg-[#10b981]" />
                        Создан
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#9ca3af]">
                        <span className="size-1.5 rounded-full bg-slate-300" />
                        Не создан
                      </span>
                    )
                  }
                />
                <ProfileInfoField label="Дата создания" value={formatDate(detail.createdAt)} />
                <ProfileInfoField
                  label="Последняя активность"
                  value={detail.lastLoginAt ? formatDate(detail.lastLoginAt) : '—'}
                />
              </div>
            </ProfileCard>
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
