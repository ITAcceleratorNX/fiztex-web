import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useAccessRequestStats } from '@/hooks/queries';
import { AccessRequestsPanel } from '@/pages/access/AccessRequestsPanel';
import { AccessJournalPanel } from '@/pages/access/AccessJournalPanel';
import { IssuedSecretModal } from '../components/IssuedSecretModal';
import { useToast } from '@/context/ToastContext';
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS } from '../labels';
import {
  exportAccessCodesCsv,
  listAccessCodes,
  reissueCode,
  resetAccess,
  resetPin,
} from '../services';
import type { AccountRole, AccountStatus, PlatformUser } from '../types';
import { platformErrorMessage } from '../platformErrorMessage';

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

type SectionTab = 'codes' | 'requests' | 'journal';

/** Подзаголовок шапки меняется вместе с вкладкой (D0 / D1): он объясняет, что под ней. */
const TAB_DESCRIPTIONS: Record<SectionTab, string> = {
  codes: 'Для ученика доступны PIN и персональный код. Родителю или учителю можно сбросить доступ, чтобы выдать новый код активации.',
  requests: 'Ученики и родители, которые отправили заявку из приложения',
  journal: 'Кто и что делал с доступом: заявки, персональные коды, PIN, временные пароли, смена телефона и разрешения учителям. Записи не удаляются и не правятся.',
};

/**
 * Вкладки раздела (макет D0). Счётчик на вкладке — только нерассмотренные заявки:
 * вкладка зовёт к работе, а одобренные и отклонённые её уже не требуют.
 *
 * Шапка своя, а не общая `AppHeader`: у раздела подзаголовок под каждую вкладку.
 */
export function AccessCodesPage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: SectionTab = tabParam === 'requests' || tabParam === 'journal' ? tabParam : 'codes';
  const stats = useAccessRequestStats();
  const pending = stats.data?.pending ?? 0;

  return (
    <div className="flex flex-col gap-5">
    <PageHeader eyebrow="Управление школой" title="Доступы / коды" description={TAB_DESCRIPTIONS[tab]} />
    <Tabs
      value={tab}
      variant="navy"
      // Фильтры вкладок свои и несовместимые (`stage` у заявок, `event` и даты у журнала),
      // поэтому переключение начинает адрес заново, а не тащит чужие параметры.
      onValueChange={(value) => {
        const next = new URLSearchParams();
        if (value !== 'codes') next.set('tab', value);
        setParams(next);
      }}
    >
      <TabsList>
        <TabsTrigger value="codes">Коды и PIN</TabsTrigger>
        <TabsTrigger value="requests" count={pending}>Заявки на доступ</TabsTrigger>
        <TabsTrigger value="journal">Журнал доступа</TabsTrigger>
      </TabsList>
      <TabsContent value={tab} className="mt-5 focus-visible:outline-none">
        {tab === 'requests' && <AccessRequestsPanel />}
        {tab === 'journal' && <AccessJournalPanel />}
        {tab === 'codes' && <CodesPanel />}
      </TabsContent>
    </Tabs>
    </div>
  );
}

/** Состояние аккаунта в реестре — цветом слова, без плашки (D0). */
const STATUS_TONE: Record<AccountStatus, string> = {
  ACTIVE: 'text-planning-success-fg',
  NOT_ACTIVATED: 'text-amber-700',
  BLOCKED: 'text-red-700',
  ARCHIVED: 'text-planning-subtle',
};

const CODE_NOTE = 'Прежний код перестал работать. PIN у ученика остался прежним.';
const RESET_NOTE = 'Человек войдёт по нему и задаст новый пароль. Прежние сессии завершены.';

function CodesPanel() {
  const toast = useToast();
  const [issued, setIssued] = useState<{ title: string; value: string; note: string } | null>(null);
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
      setError(platformErrorMessage(err, 'Не удалось загрузить данные доступа. Попробуйте ещё раз.'));
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
        // Код показывается окном, а не тостом: сервер отдаёт его один раз.
        setIssued({ title: 'Персональный код выдан', value: res.issuedCode ?? '', note: CODE_NOTE });
      } else {
        if (pending.user.role !== 'PARENT' && pending.user.role !== 'TEACHER') {
          throw new Error('Сброс доступа только для родителя или учителя');
        }
        const res = await resetAccess(pending.user.id, pending.user.role);
        setIssued({ title: 'Код восстановления выдан', value: res.issuedCode ?? '', note: RESET_NOTE });
      }
      setPending(null);
      await reload();
    } catch (err) {
      toast.error(platformErrorMessage(err, 'Не удалось изменить доступ. Попробуйте ещё раз.'));
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
      toast.error(platformErrorMessage(err, 'Не удалось скачать список кодов. Попробуйте ещё раз.'));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          className="flex-1"
          value={query}
          onChange={setQuery}
          placeholder="Поиск по ФИО"
        />
        <div className="lg:w-filter-select">
          <Select
            aria-label="Роль"
            className="h-11"
            value={role}
            onChange={(e) => setRole(e.target.value as AccountRole | 'ALL')}
          >
            <option value="ALL">Все роли</option>
            <option value="STUDENT">Ученик</option>
            <option value="PARENT">Родитель</option>
            <option value="TEACHER">Учитель</option>
            <option value="ADMIN">Админ</option>
          </Select>
        </div>
        <Button variant="secondary" className="shrink-0" onClick={() => void handleExport()}>
          CSV
        </Button>
      </div>

      {loading && <div className="card"><LoadingBlock /></div>}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void reload()} />}
      {!loading && !error && users.length === 0 && (
        <div className="card">
          <EmptyBlock title="Нет пользователей" description="Создайте аккаунт на странице Пользователи." />
        </div>
      )}
      {!loading && !error && users.length > 0 && (
        <DataTable label="Коды и PIN" appearance="registry">
          <thead>
            <tr>
              <th scope="col">ФИО</th>
              <th scope="col" className="w-36">Роль</th>
              <th scope="col" className="w-40">Статус</th>
              <th scope="col" className="w-56">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="font-semibold">{user.fullName}</td>
                <td>{ROLE_LABELS[user.role]}</td>
                <td className={STATUS_TONE[user.status]}>{ACCOUNT_STATUS_LABELS[user.status]}</td>
                <td>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {user.role === 'STUDENT' && (
                      <>
                        <Button variant="link" size="inline" onClick={() => setPending({ type: 'resetPin', user })}>
                          Сброс PIN
                        </Button>
                        <Button variant="link" size="inline" onClick={() => setPending({ type: 'reissue', user })}>
                          Новый код
                        </Button>
                      </>
                    )}
                    {(user.role === 'PARENT' || user.role === 'TEACHER') && (
                      <Button variant="link" size="inline" onClick={() => setPending({ type: 'resetAccess', user })}>
                        Сброс доступа
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
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

      <IssuedSecretModal
        open={issued !== null}
        title={issued?.title ?? ''}
        value={issued?.value ?? null}
        note={issued?.note ?? ''}
        onClose={() => setIssued(null)}
      />
    </div>
  );
}
