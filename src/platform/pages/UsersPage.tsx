import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Pencil,
  Plus,
  Search,
  Users as UsersIcon,
} from 'lucide-react';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { cx, formatDate, initials, pluralRu } from '@/lib/format';
import { CreateUserMenu, type CreateUserMenuAction } from '../components/CreateUserMenu';
import { useInvalidateUserStats, useUserStats } from '../hooks/useUserStats';
import {
  ACCOUNT_STATUS_LABELS,
  ROLE_AVATAR_COLOR,
  ROLE_LABELS,
} from '../labels';
import { CreateAdminModal } from '../modals/CreateAdminModal';
import { CreateParentModal } from '../modals/CreateParentModal';
import { CreateStudentModal } from '../modals/CreateStudentModal';
import { CreateTeacherModal } from '../modals/CreateTeacherModal';
import { UserDetailModal } from '../modals/UserDetailModal';
import { UserFormModal } from '../modals/UserFormModal';
import { archiveUser, blockUser, listUsersPage, unblockUser } from '../services';
import type { AccountRole, AccountStatus, PlatformUser } from '../types';

const PAGE_SIZE = 20;

const ROLE_FILTERS: { value: AccountRole | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'STUDENT', label: 'Ученики' },
  { value: 'PARENT', label: 'Родители' },
  { value: 'TEACHER', label: 'Учителя' },
  { value: 'ADMIN', label: 'Админы' },
];

const STATUS_TABS: { value: AccountStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Активные' },
  { value: 'NOT_ACTIVATED', label: 'Не активированы' },
  { value: 'BLOCKED', label: 'Заблокированные' },
  { value: 'ARCHIVED', label: 'Архив' },
];

const ROLE_ROUTES: Partial<Record<AccountRole, string>> = {
  STUDENT: '/students',
  PARENT: '/parents',
  TEACHER: '/teachers',
};

const PROFILE_ROUTES: Partial<Record<AccountRole, string>> = {
  STUDENT: '/students',
  PARENT: '/parents',
  TEACHER: '/teachers',
};

const PAGE_TITLES: Partial<Record<AccountRole, string>> = {
  STUDENT: 'Ученики',
  PARENT: 'Родители',
  TEACHER: 'Учителя',
};

/** Role badge colors from Figma table. */
const ROLE_BADGE: Record<AccountRole, string> = {
  STUDENT: 'bg-[#eff6ff] text-[#2563eb]',
  PARENT: 'bg-[#fff7ed] text-[#c2410c]',
  TEACHER: 'bg-[#f5f3ff] text-[#4f46e5]',
  ADMIN: 'bg-[#f1f5f9] text-[#374151]',
  SUPER_ADMIN: 'bg-[#f1f5f9] text-[#374151]',
};

const STATUS_BADGE: Record<AccountStatus, string> = {
  ACTIVE: 'bg-[#ecfdf5] text-[#059669]',
  NOT_ACTIVATED: 'bg-amber-50 text-amber-700',
  BLOCKED: 'bg-red-50 text-red-600',
  ARCHIVED: 'bg-slate-100 text-slate-500',
};

const STATUS_DOT: Record<AccountStatus, string> = {
  ACTIVE: 'bg-[#10b981]',
  NOT_ACTIVATED: 'bg-amber-500',
  BLOCKED: 'bg-red-500',
  ARCHIVED: 'bg-slate-400',
};

function formatCount(value: number | undefined | null): string {
  if (value == null) return '—';
  return value.toLocaleString('ru-RU');
}

function StatTile({
  label,
  value,
  icon,
  iconClass,
  active,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  iconClass: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const className = cx(
    'flex h-[94px] w-full items-center justify-between rounded-xl border bg-white p-5 text-left shadow-[0px_2px_2px_rgba(0,0,0,0.02)] transition',
    active ? 'border-navy-700 ring-1 ring-navy-700/20' : 'border-[#e8edf5]',
    onClick && 'hover:border-slate-300',
  );
  const body = (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#9ca3af]">{label}</p>
        <p className="text-2xl font-bold leading-none text-[#1a1f36]">{value}</p>
      </div>
      <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-[20px]', iconClass)}>
        {icon}
      </span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

function RoleBadge({ role }: { role: AccountRole }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-[20px] px-2.5 py-1 text-xs font-semibold',
        ROLE_BADGE[role],
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-[20px] py-1 pl-2 pr-2.5 text-xs font-medium',
        STATUS_BADGE[status],
      )}
    >
      <span className={cx('size-1.5 rounded-full', STATUS_DOT[status])} />
      {status === 'ACTIVE' ? 'Активен' : ACCOUNT_STATUS_LABELS[status]}
    </span>
  );
}

function UserAvatar({ name, role }: { name: string; role: AccountRole }) {
  const color = ROLE_AVATAR_COLOR[role];
  return (
    <span
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-2xl text-xs font-bold text-white"
      style={{ backgroundColor: color.bg }}
    >
      {initials(name)}
    </span>
  );
}

export function UsersPage({ forcedRole }: { forcedRole?: AccountRole } = {}) {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role: AccountRole | 'ALL' = forcedRole ?? (searchParams.get('role') as AccountRole | null) ?? 'ALL';
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<AccountStatus>('ACTIVE');
  const [page, setPage] = useState(0);

  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: stats } = useUserStats();
  const invalidateStats = useInvalidateUserStats();

  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [createRole, setCreateRole] = useState<AccountRole | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<PlatformUser | null>(null);
  const [editing, setEditing] = useState<PlatformUser | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listUsersPage({ query, role, status, page, size: PAGE_SIZE });
      setUsers(result.users);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  }, [query, role, status, page]);

  function handleCreateMenuSelect(action: CreateUserMenuAction) {
    if (action === 'IMPORT') {
      navigate('/admin/import');
      return;
    }
    setCreateRole(action);
  }

  function handleCreated() {
    void reload();
    void invalidateStats();
  }

  useEffect(() => {
    const handle = window.setTimeout(() => void reload(), query ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [reload, query]);

  useEffect(() => {
    setPage(0);
  }, [query, role, status]);

  async function handleBlock(user: PlatformUser) {
    try {
      await blockUser(user.id);
      toast.success('Пользователь заблокирован');
      setDetailOpen(false);
      await Promise.all([reload(), invalidateStats()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось заблокировать');
    }
  }

  async function handleUnblock(user: PlatformUser) {
    try {
      await unblockUser(user.id);
      toast.success('Пользователь разблокирован');
      setDetailOpen(false);
      await Promise.all([reload(), invalidateStats()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось разблокировать');
    }
  }

  async function handleArchive(user: PlatformUser) {
    if (!window.confirm(`Архивировать ${user.fullName}?`)) return;
    try {
      await archiveUser(user.id);
      toast.success('Пользователь архивирован');
      setDetailOpen(false);
      await Promise.all([reload(), invalidateStats()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось архивировать');
    }
  }

  function openDetail(user: PlatformUser) {
    setSelected(user);
    setDetailOpen(true);
  }

  function openRow(user: PlatformUser) {
    const profileRoute = PROFILE_ROUTES[user.role];
    if (profileRoute) {
      navigate(`${profileRoute}/${user.id}`);
    } else {
      openDetail(user);
    }
  }

  function selectRole(next: AccountRole | 'ALL') {
    if (next === 'ALL') {
      navigate('/admin/users');
      return;
    }
    const route = ROLE_ROUTES[next];
    if (route) {
      navigate(route);
    } else {
      navigate(`/admin/users?role=${next}`);
    }
  }

  const rangeFrom = totalElements === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeTo = Math.min(totalElements, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-[28px] font-bold leading-none tracking-tight text-[#1a1f36]">
        {forcedRole ? PAGE_TITLES[forcedRole] : 'Пользователи'}
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label="Всего пользователей"
          value={formatCount(stats?.total)}
          icon={<UsersIcon className="size-5 text-navy-700" />}
          iconClass="bg-[rgba(39,65,133,0.08)]"
        />
        <StatTile
          label="Активные"
          value={formatCount(stats?.active)}
          icon={<CheckCircle2 className="size-5 text-emerald-500" />}
          iconClass="bg-[rgba(34,197,94,0.08)]"
          active={status === 'ACTIVE'}
          onClick={() => setStatus('ACTIVE')}
        />
        <StatTile
          label="Не активированы"
          value={formatCount(stats?.notActivated)}
          icon={<Clock className="size-5 text-brand-500" />}
          iconClass="bg-[rgba(251,146,60,0.08)]"
          active={status === 'NOT_ACTIVATED'}
          onClick={() => setStatus('NOT_ACTIVATED')}
        />
        <StatTile
          label="Заблокированы"
          value={formatCount(stats?.blocked)}
          icon={<Lock className="size-5 text-red-500" />}
          iconClass="bg-[rgba(239,68,68,0.08)]"
          active={status === 'BLOCKED'}
          onClick={() => setStatus('BLOCKED')}
        />
        <StatTile
          label="Архив"
          value={formatCount(stats?.archived)}
          icon={<Archive className="size-5 text-slate-400" />}
          iconClass="bg-[rgba(156,163,175,0.08)]"
          active={status === 'ARCHIVED'}
          onClick={() => setStatus('ARCHIVED')}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex h-9 w-[300px] max-w-full items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3">
              <Search className="size-3.5 shrink-0 text-[#9ca3af]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по ФИО, телефону или Email..."
                className="h-full w-full bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-[#9ca3af]"
              />
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#f3f4f6] p-1">
              {ROLE_FILTERS.map((r) => {
                const selected = role === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => selectRole(r.value)}
                    className={cx(
                      'rounded-md px-3.5 py-1.5 text-[13px] transition',
                      selected
                        ? 'bg-navy-700 font-semibold text-white'
                        : 'font-medium text-[#6b7280] hover:text-slate-800',
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setCreateMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={createMenuOpen}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white shadow-[0px_4px_5px_rgba(251,146,60,0.1)] transition hover:bg-brand-600"
            >
              <Plus className="size-4" strokeWidth={2.5} />
              Добавить пользователя
            </button>
            <CreateUserMenu
              open={createMenuOpen}
              onClose={() => setCreateMenuOpen(false)}
              onSelect={handleCreateMenuSelect}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((t) => {
            const selected = status === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setStatus(t.value)}
                className={cx(
                  'rounded-md px-3 py-1.5 text-[13px] transition',
                  selected
                    ? 'bg-navy-700 font-semibold text-white'
                    : 'border border-[#e5e7eb] bg-[#f3f4f6] font-medium text-[#6b7280] hover:border-slate-300 hover:text-slate-800',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0px_4px_6px_rgba(0,0,0,0.02)]">
        {loading ? (
          <LoadingBlock label="Загрузка пользователей…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={() => void reload()} />
        ) : users.length === 0 ? (
          <EmptyBlock title="Никого не найдено" description="Измените фильтры или создайте пользователя." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="h-10 border-b border-[#e5e7eb] bg-[#f9fafb] text-left text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                  <th className="px-6 font-semibold">ФИО</th>
                  <th className="w-[130px] px-2 font-semibold">Роль</th>
                  <th className="w-[180px] px-2 font-semibold">Телефон / Email</th>
                  <th className="w-[200px] px-2 font-semibold">Класс / Связь</th>
                  <th className="w-[160px] px-2 font-semibold">Статус</th>
                  <th className="w-[140px] px-2 font-semibold">Дата создания</th>
                  <th className="w-20 px-2 text-right font-semibold">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => openRow(user)}
                    className="h-[52px] cursor-pointer border-b border-[#f3f4f6] transition last:border-b-0 hover:bg-slate-50/80"
                  >
                    <td className="px-6">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar name={user.fullName} role={user.role} />
                        <span className="truncate text-sm font-semibold text-[#1a1f36]">
                          {user.fullName}
                        </span>
                      </div>
                    </td>
                    <td className="px-2">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="max-w-[180px] truncate px-2 text-[13px] text-[#6b7280]">
                      {user.phone ?? user.email ?? '—'}
                    </td>
                    <td className="max-w-[200px] truncate px-2 text-[13px] text-[#1a1f36]">
                      {user.relationLabel ?? '—'}
                    </td>
                    <td className="px-2">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-2 text-[13px] text-[#6b7280]">{formatDate(user.createdAt)}</td>
                    <td className="px-2">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          title="Редактировать"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (PROFILE_ROUTES[user.role]) {
                              navigate(`${PROFILE_ROUTES[user.role]}/${user.id}`);
                              return;
                            }
                            setEditing(user);
                            setFormOpen(true);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && totalElements > 0 && (
          <div className="flex h-11 items-center justify-between rounded-b-2xl bg-[#f9fafb] px-6 text-[13px] text-[#9ca3af]">
            <span>
              {rangeFrom}–{rangeTo} из {formatCount(totalElements)}{' '}
              {pluralRu(totalElements, ['пользователя', 'пользователей', 'пользователей'])}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="flex size-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex size-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateStudentModal
        open={createRole === 'STUDENT'}
        onClose={() => setCreateRole(null)}
        onSaved={handleCreated}
      />
      <CreateParentModal
        open={createRole === 'PARENT'}
        onClose={() => setCreateRole(null)}
        onSaved={handleCreated}
      />
      <CreateTeacherModal
        open={createRole === 'TEACHER'}
        onClose={() => setCreateRole(null)}
        onSaved={handleCreated}
      />
      <CreateAdminModal
        open={createRole === 'ADMIN'}
        onClose={() => setCreateRole(null)}
        onSaved={handleCreated}
      />

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        user={editing}
        onSaved={handleCreated}
      />
      <UserDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        user={selected}
        onEdit={() => {
          setDetailOpen(false);
          setEditing(selected);
          setFormOpen(true);
        }}
        onBlock={() => {
          if (selected) void handleBlock(selected);
        }}
        onUnblock={() => {
          if (selected) void handleUnblock(selected);
        }}
        onArchive={() => {
          if (selected) void handleArchive(selected);
        }}
      />
    </div>
  );
}
