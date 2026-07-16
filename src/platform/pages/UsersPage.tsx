import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS } from '../labels';
import { UserDetailModal } from '../modals/UserDetailModal';
import { UserFormModal } from '../modals/UserFormModal';
import { archiveUser, blockUser, listUsers, unblockUser } from '../services';
import type { AccountRole, AccountStatus, PlatformUser } from '../types';

const FILTER_ROLES: Array<AccountRole | 'ALL'> = ['ALL', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT'];
const FILTER_STATUSES: Array<AccountStatus | 'ALL'> = [
  'ALL',
  'NOT_ACTIVATED',
  'ACTIVE',
  'BLOCKED',
  'ARCHIVED',
];

export function UsersPage() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<AccountRole | 'ALL'>('ALL');
  const [status, setStatus] = useState<AccountStatus | 'ALL'>('ALL');
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<PlatformUser | null>(null);
  const [editing, setEditing] = useState<PlatformUser | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers({ query, role, status });
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  }, [query, role, status]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void reload();
    }, query ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [reload, query]);

  async function handleBlock(user: PlatformUser) {
    try {
      await blockUser(user.id);
      toast.success('Пользователь заблокирован');
      setDetailOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось заблокировать');
    }
  }

  async function handleUnblock(user: PlatformUser) {
    try {
      await unblockUser(user.id);
      toast.success('Пользователь разблокирован');
      setDetailOpen(false);
      await reload();
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
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось архивировать');
    }
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        При создании учителя, родителя или ученика сразу создаётся школьная карточка (по ФИО).
        Доступны блок / разблок / архив аккаунта.
      </p>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          className="flex-1"
          value={query}
          onChange={setQuery}
          placeholder="Поиск по ФИО, телефону или email"
        />
        <div className="lg:w-44">
          <Select value={role} onChange={(e) => setRole(e.target.value as AccountRole | 'ALL')}>
            {FILTER_ROLES.map((value) => (
              <option key={value} value={value}>
                {value === 'ALL' ? 'Все роли' : ROLE_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <div className="lg:w-48">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as AccountStatus | 'ALL')}
          >
            {FILTER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value === 'ALL' ? 'Все статусы' : ACCOUNT_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          Создать пользователя
        </Button>
      </div>

      {loading && <LoadingBlock />}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void reload()} />}
      {!loading && !error && users.length === 0 && (
        <div className="card">
          <EmptyBlock
            title="Никого не найдено"
            description="Измените фильтры или создайте пользователя."
          />
        </div>
      )}
      {!loading && !error && users.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">ФИО</th>
                <th className="px-4 py-3 font-semibold">Роль</th>
                <th className="px-4 py-3 font-semibold">Контакт</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Связи</th>
                <th className="px-4 py-3 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{user.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[user.role]}</td>
                  <td className="px-4 py-3 text-slate-600">{user.phone ?? user.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{ACCOUNT_STATUS_LABELS[user.status]}</td>
                  <td className="px-4 py-3 text-slate-500">{user.relationLabel ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelected(user);
                          setDetailOpen(true);
                        }}
                      >
                        Просмотр
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(user);
                          setFormOpen(true);
                        }}
                      >
                        Изменить
                      </Button>
                      {user.status !== 'BLOCKED' && user.status !== 'ARCHIVED' && (
                        <Button variant="ghost" size="sm" onClick={() => void handleBlock(user)}>
                          Блок
                        </Button>
                      )}
                      {user.status === 'BLOCKED' && (
                        <Button variant="ghost" size="sm" onClick={() => void handleUnblock(user)}>
                          Разблок
                        </Button>
                      )}
                      {user.status !== 'ARCHIVED' && (
                        <Button variant="ghost" size="sm" onClick={() => void handleArchive(user)}>
                          Архив
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        user={editing}
        onSaved={() => void reload()}
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
