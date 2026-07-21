import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, CheckCircle2, ChevronLeft, ChevronRight, Clock, Lock, Pencil, Plus, Users as UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { cx, formatDate, pluralRu } from '@/lib/format';
import { useInvalidateUserStats, useUserStats } from '../hooks/useUserStats';
import { ACCOUNT_STATUS_LABELS, ROLE_AVATAR_COLOR, ROLE_BADGE_TONE, ROLE_LABELS } from '../labels';
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

/** Routes with a dedicated sidebar item — role filters navigate here instead of using local state. */
const ROLE_ROUTES: Partial<Record<AccountRole, string>> = {
  STUDENT: '/students',
  PARENT: '/parents',
  TEACHER: '/teachers',
};

/** Roles with a dedicated profile page (matches the Figma profile designs). */
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

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone: 'slate' | 'green' | 'amber' | 'red';
}) {
  const toneClasses: Record<typeof tone, string> = {
    slate: 'bg-slate-100 text-slate-500',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="card flex items-center justify-between px-5 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-2 text-3xl font-extrabold text-slate-900">{value}</p>
      </div>
      <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', toneClasses[tone])}>
        {icon}
      </span>
    </div>
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
      // ADMIN has no dedicated sidebar route — filter in place on the unified page.
      navigate(`/admin/users?role=${next}`);
    }
  }

  const rangeFrom = totalElements === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeTo = Math.min(totalElements, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
        {forcedRole ? PAGE_TITLES[forcedRole] : 'Пользователи'}
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Всего пользователей" value={stats?.total ?? '—'} icon={<UsersIcon className="h-5 w-5" />} tone="slate" />
        <StatTile label="Активные" value={stats?.active ?? '—'} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <StatTile label="Не активированы" value={stats?.notActivated ?? '—'} icon={<Clock className="h-5 w-5" />} tone="amber" />
        <StatTile label="Заблокированы" value={stats?.blocked ?? '—'} icon={<Lock className="h-5 w-5" />} tone="red" />
        <StatTile label="Архив" value={stats?.archived ?? '—'} icon={<Archive className="h-5 w-5" />} tone="slate" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SearchInput
          className="w-full max-w-xs"
          value={query}
          onChange={setQuery}
          placeholder="Поиск по ФИО, телефону или Email…"
        />
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => selectRole(r.value)}
              className={cx(
                'rounded-lg px-3.5 py-1.5 text-sm font-medium transition',
                role === r.value ? 'bg-navy-700 text-white' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Добавить пользователя
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setStatus(t.value)}
            className={cx(
              'rounded-lg px-4 py-2 text-sm font-medium transition',
              status === t.value ? 'bg-navy-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card mt-4 overflow-hidden">
        {loading ? (
          <LoadingBlock label="Загрузка пользователей…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={() => void reload()} />
        ) : users.length === 0 ? (
          <EmptyBlock title="Никого не найдено" description="Измените фильтры или создайте пользователя." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3.5">ФИО</th>
                  <th className="px-6 py-3.5">Роль</th>
                  <th className="px-6 py-3.5">Телефон / Email</th>
                  <th className="px-6 py-3.5">Класс / Связь</th>
                  <th className="px-6 py-3.5">Статус</th>
                  <th className="px-6 py-3.5">Дата создания</th>
                  <th className="px-6 py-3.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((user) => (
                  <tr key={user.id} onClick={() => openRow(user)} className="cursor-pointer transition hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.fullName} size="sm" color={ROLE_AVATAR_COLOR[user.role]} />
                        <span className="font-semibold text-slate-800">{user.fullName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge tone={ROLE_BADGE_TONE[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{user.phone ?? user.email ?? '—'}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{user.relationLabel ?? '—'}</td>
                    <td className="px-6 py-3.5">
                      {user.status === 'ACTIVE' ? (
                        <Badge tone="green" dot>Активен</Badge>
                      ) : (
                        <Badge tone="gray" dot>{ACCOUNT_STATUS_LABELS[user.status]}</Badge>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-500">{formatDate(user.createdAt)}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {PROFILE_ROUTES[user.role] ? (
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing(user);
                              setFormOpen(true);
                            }}
                            title="Редактировать"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && totalElements > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-sm text-slate-400">
            <span>
              {rangeFrom}–{rangeTo} из {totalElements} {pluralRu(totalElements, ['пользователя', 'пользователей', 'пользователей'])}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        user={editing}
        onSaved={() => {
          void reload();
          void invalidateStats();
        }}
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
