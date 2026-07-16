import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS } from '../labels';
import {
  exportAccessCodesCsv,
  listAccessCodes,
  reissueCode,
  resetAccess,
  resetPin,
} from '../services';
import type { AccountRole, PlatformUser } from '../types';

type PendingAction = {
  type: 'resetPin' | 'reissue' | 'resetAccess';
  user: PlatformUser;
};

const ACTION_COPY: Record<
  PendingAction['type'],
  { title: string; message: string; confirm: string; danger?: boolean }
> = {
  resetPin: {
    title: 'Сбросить PIN?',
    message: 'Ученику потребуется повторная активация с новым PIN.',
    confirm: 'Сбросить PIN',
  },
  reissue: {
    title: 'Перевыпустить персональный код?',
    message: 'Старый код ученика перестанет работать. Новый код покажем после подтверждения.',
    confirm: 'Перевыпустить',
  },
  resetAccess: {
    title: 'Сбросить доступ?',
    message: 'Пароль сбросится, статус станет «не активирован». Будет выдан новый код активации.',
    confirm: 'Сбросить доступ',
    danger: true,
  },
};

export function AccessCodesPage() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<AccountRole | 'ALL'>('ALL');
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listAccessCodes({ query, role }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  }, [query, role]);

  useEffect(() => {
    const handle = window.setTimeout(() => void reload(), query ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [reload, query]);

  async function confirmAction() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.type === 'resetPin') {
        const res = await resetPin(pending.user.id);
        toast.success(res.message);
      } else if (pending.type === 'reissue') {
        const res = await reissueCode(pending.user.id);
        toast.success(res.message);
      } else {
        if (pending.user.role !== 'PARENT' && pending.user.role !== 'TEACHER') {
          throw new Error('Сброс доступа только для родителя или учителя');
        }
        const res = await resetAccess(pending.user.id, pending.user.role);
        toast.success(res.message);
      }
      setPending(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Действие не выполнено');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    try {
      const { fileName, content } = await exportAccessCodesCsv();
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('CSV скачан');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось экспортировать');
    }
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Управление кодами и доступом через реальный API (account id). Для ученика — PIN и
        персональный код; для родителя/учителя — сброс доступа с новым кодом активации.
      </p>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          className="flex-1"
          value={query}
          onChange={setQuery}
          placeholder="Поиск по ФИО"
        />
        <div className="lg:w-44">
          <Select value={role} onChange={(e) => setRole(e.target.value as AccountRole | 'ALL')}>
            <option value="ALL">Все роли</option>
            <option value="STUDENT">Ученик</option>
            <option value="PARENT">Родитель</option>
            <option value="TEACHER">Учитель</option>
            <option value="ADMIN">Админ</option>
          </Select>
        </div>
        <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => void handleExport()}>
          CSV
        </Button>
      </div>

      {loading && <LoadingBlock />}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void reload()} />}
      {!loading && !error && users.length === 0 && (
        <div className="card">
          <EmptyBlock title="Нет пользователей" description="Создайте аккаунт на странице Пользователи." />
        </div>
      )}
      {!loading && !error && users.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">ФИО</th>
                <th className="px-4 py-3 font-semibold">Роль</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{user.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[user.role]}</td>
                  <td className="px-4 py-3 text-slate-600">{ACCOUNT_STATUS_LABELS[user.status]}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.role === 'STUDENT' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPending({ type: 'resetPin', user })}
                          >
                            Сброс PIN
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPending({ type: 'reissue', user })}
                          >
                            Новый код
                          </Button>
                        </>
                      )}
                      {(user.role === 'PARENT' || user.role === 'TEACHER') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPending({ type: 'resetAccess', user })}
                        >
                          Сброс доступа
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

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending ? ACTION_COPY[pending.type].title : ''}
        message={pending ? ACTION_COPY[pending.type].message : ''}
        confirmLabel={pending ? ACTION_COPY[pending.type].confirm : 'OK'}
        danger={pending ? ACTION_COPY[pending.type].danger : false}
        loading={busy}
        onConfirm={() => void confirmAction()}
      />
    </div>
  );
}
