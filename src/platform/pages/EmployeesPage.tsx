import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, Plus, Search, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cx, formatDate, initials, pluralRu } from '@/lib/format';
import {
  EMPLOYEE_ROLES,
  EMPLOYEE_ROLE_LABELS,
  EMPLOYEE_STATE_FILTER_LABELS,
  canBlock,
  canUnblock,
  employeeRoleLabel,
  employeeState,
  type EmployeeRole,
  type EmployeeState,
} from '@/lib/employeesModel';
import { ACCOUNT_STATUS_LABELS, ROLE_AVATAR_COLOR } from '../labels';
import { CreateEmployeeModal } from '../modals/CreateEmployeeModal';
import { EmployeeDetailModal } from '../modals/EmployeeDetailModal';
import { IssuedCodeModal } from '../modals/IssuedCodeModal';
import { useInvalidateUserStats } from '../hooks/useUserStats';
import {
  changeEmployeeRole,
  listAccountsByRoles,
  resetEmployeeAccess,
  setAccountActive,
} from '../services';
import type { AccountStatus, PlatformUser } from '../types';

/**
 * Внутренние сотрудники школы — раздел Super Admin (ТЗ SERVICE-FE-004 §3, §4).
 *
 * Живёт внутри «Пользователей» и повторяет их устройство: тот же поиск, те же чипы
 * фильтров, та же таблица. Отдельной админки здесь нет и по замыслу быть не должно —
 * «главный принцип» ТЗ требует добавить права и экраны, а не вторую панель.
 *
 * Своей страницей, а не ролью в общей таблице, потому что ролей три: `/admin/accounts`
 * принимает одну за раз, и «все сотрудники» в общем списке пришлось бы собирать из
 * нескольких выдач при каждом переключении чипа.
 *
 * **Список без пагинации.** Служебных аккаунтов в школе десятки: три выдачи по двести
 * строк покрывают их с запасом, а склеенную страницу всё равно пришлось бы резать
 * заново — порядок в ней задаёт клиент, а не сервер.
 */

const STATE_TABS: { value: EmployeeState | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'ACTIVE', label: EMPLOYEE_STATE_FILTER_LABELS.ACTIVE },
  { value: 'INACTIVE', label: EMPLOYEE_STATE_FILTER_LABELS.INACTIVE },
];

const ROLE_TABS: { value: EmployeeRole | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Все роли' },
  ...EMPLOYEE_ROLES.map((role) => ({ value: role, label: EMPLOYEE_ROLE_LABELS[role] })),
];

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

export function EmployeesPage() {
  useDocumentTitle('Сотрудники');

  const toast = useToast();
  const qc = useQueryClient();
  const invalidateStats = useInvalidateUserStats();

  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query);
  const [role, setRole] = useState<EmployeeRole | 'ALL'>('ALL');
  const [state, setState] = useState<EmployeeState | 'ALL'>('ALL');

  const [employees, setEmployees] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<PlatformUser | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirm, setConfirm] = useState<PendingAction | null>(null);
  const [issuedCode, setIssuedCode] = useState<{ code: string; name: string } | null>(null);
  const [pending, setPending] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const roles = role === 'ALL' ? EMPLOYEE_ROLES : [role];
      const rows = await listAccountsByRoles(roles, { query: search });
      // Порядок задаётся здесь, потому что список склеен из нескольких выдач: у сервера
      // общего порядка для них нет.
      rows.sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'));
      setEmployees(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить сотрудников');
    } finally {
      setLoading(false);
    }
  }, [role, search]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows = employees.filter((row) => state === 'ALL' || employeeState(row.status) === state);
  const confirmed = confirm ? confirmText(confirm) : null;

  /**
   * §4: результат действия берётся из бэкенда, а не досчитывается на экране.
   *
   * Поэтому после успеха перечитываются и сотрудники, и заявки: блокировка и смена роли
   * возвращают в очередь то, что было у человека в работе, и знать об этом экран может
   * только из следующего ответа.
   *
   * Одна воронка на все четыре действия: у них общий порядок — выполнить, сказать
   * человеку, перечитать, — и три копии этого порядка разошлись бы на первой же правке.
   */
  async function run(action: PendingAction) {
    setPending(true);
    try {
      const message = await perform(action);
      toast.success(message);
      setConfirm(null);
      setDetailOpen(false);
      await Promise.all([
        reload(),
        invalidateStats(),
        qc.invalidateQueries({ queryKey: ['service-requests'] }),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось выполнить действие');
    } finally {
      setPending(false);
    }
  }

  async function perform(action: PendingAction): Promise<string> {
    switch (action.kind) {
      case 'UNBLOCK':
        await setAccountActive(action.employee.id, true);
        return 'Сотрудник разблокирован';
      case 'BLOCK':
        await setAccountActive(action.employee.id, false);
        return 'Сотрудник заблокирован';
      case 'ROLE': {
        const updated = await changeEmployeeRole(action.employee.id, action.role);
        return `Роль изменена: ${employeeRoleLabel(updated.role)}`;
      }
      case 'RESET': {
        const code = await resetEmployeeAccess(action.employee.id);
        // Код показываем окном, а не тостом: он выдаётся один раз, и уехавшее
        // уведомление означало бы сброс доступа заново.
        setIssuedCode({ code, name: action.employee.fullName });
        return 'Доступ сброшен — передайте код сотруднику';
      }
    }
  }

  /**
   * Спросить подтверждение вместо карточки, а не поверх неё: два окна друг на друге
   * делят одну блокировку прокрутки страницы и гасят её раньше времени.
   *
   * `false` принимается наравне с `null`, потому что вызывающий пишет
   * `ask(selected && …)`: сотрудник к этому моменту всегда выбран, но доказывать это
   * типам отдельной проверкой на каждой кнопке было бы шумом.
   */
  function ask(action: PendingAction | null | false) {
    if (!action) return;
    setDetailOpen(false);
    setConfirm(action);
  }

  function openDetail(employee: PlatformUser) {
    setSelected(employee);
    setDetailOpen(true);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[28px] font-bold leading-none tracking-tight text-[#1a1f36]">
          Сотрудники
        </h1>
        {!loading && !error && (
          <span className="text-[15px] font-medium tabular-nums text-[#9ca3af]">{rows.length}</span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex h-9 w-[300px] max-w-full items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3">
              <Search className="size-3.5 shrink-0 text-[#9ca3af]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по ФИО, телефону или Email..."
                className="h-full w-full bg-transparent text-13 text-slate-800 outline-none placeholder:text-[#9ca3af]"
              />
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#f3f4f6] p-1">
              {ROLE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setRole(tab.value)}
                  className={cx(
                    'rounded-md px-3.5 py-1.5 text-13 transition',
                    role === tab.value
                      ? 'bg-navy-700 font-semibold text-white'
                      : 'font-medium text-[#6b7280] hover:text-slate-800',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={() => setCreateOpen(true)} size="sm" icon={<Plus className="size-4" />}>
            Добавить сотрудника
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STATE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setState(tab.value)}
              className={cx(
                'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-13 transition',
                state === tab.value
                  ? 'bg-navy-700 font-semibold text-white'
                  : 'border border-[#e5e7eb] bg-[#f3f4f6] font-medium text-[#6b7280] hover:border-slate-300 hover:text-slate-800',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0px_4px_6px_rgba(0,0,0,0.02)]">
        {loading ? (
          <LoadingBlock label="Загрузка сотрудников…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={() => void reload()} />
        ) : rows.length === 0 ? (
          <EmptyBlock
            title="Сотрудников не найдено"
            description="Измените фильтры или добавьте сотрудника клининга, техслужбы или охраны."
            action={<Button onClick={() => setCreateOpen(true)}>Добавить сотрудника</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px]">
              <thead>
                <tr className="h-10 border-b border-[#e5e7eb] bg-[#f9fafb] text-left text-11 font-semibold uppercase tracking-wide text-[#9ca3af]">
                  <th className="px-6 font-semibold">ФИО</th>
                  <th className="w-[160px] px-2 font-semibold">Телефон</th>
                  <th className="w-[130px] px-2 font-semibold">Роль</th>
                  <th className="w-[170px] px-2 font-semibold">Статус</th>
                  <th className="w-[140px] px-2 font-semibold">Дата создания</th>
                  <th className="w-[220px] px-2 text-right font-semibold">Действия</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((employee) => (
                  <tr
                    key={employee.id}
                    onClick={() => openDetail(employee)}
                    className="h-[52px] cursor-pointer border-b border-[#f3f4f6] transition last:border-b-0 hover:bg-slate-50/80"
                  >
                    <td className="px-6">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-2xl text-xs font-bold text-white"
                          style={{ backgroundColor: ROLE_AVATAR_COLOR[employee.role].bg }}
                        >
                          {initials(employee.fullName)}
                        </span>
                        <span className="truncate text-sm font-semibold text-[#1a1f36]">
                          {employee.fullName}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 text-13 text-[#6b7280]">{employee.phone ?? '—'}</td>
                    <td className="px-2 text-13 text-[#1a1f36]">
                      {employeeRoleLabel(employee.role)}
                    </td>
                    <td className="px-2">
                      {/* Настоящий статус аккаунта и теми же словами, что в общей таблице
                          «Пользователи»: Active / Inactive из §3 остались крупными мазками
                          фильтра, а строка не должна называть «Заблокирован» иначе, чем
                          соседний раздел. */}
                      <span
                        className={cx(
                          'inline-flex items-center gap-1.5 rounded-[20px] py-1 pl-2 pr-2.5 text-xs font-medium',
                          STATUS_BADGE[employee.status],
                        )}
                      >
                        <span className={cx('size-1.5 rounded-full', STATUS_DOT[employee.status])} />
                        {ACCOUNT_STATUS_LABELS[employee.status]}
                      </span>
                    </td>
                    <td className="px-2 text-13 text-[#6b7280]">{formatDate(employee.createdAt)}</td>
                    <td className="px-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {canUnblock(employee.status) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void run({ kind: 'UNBLOCK', employee })}
                            disabled={pending}
                            icon={<Unlock className="size-3.5" />}
                          >
                            Разблокировать
                          </Button>
                        )}
                        {canBlock(employee.status) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setConfirm({ kind: 'BLOCK', employee })}
                            disabled={pending}
                            icon={<Lock className="size-3.5" />}
                          >
                            Заблокировать
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openDetail(employee)}>
                          Открыть
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="flex h-11 items-center rounded-b-2xl bg-[#f9fafb] px-6 text-13 text-[#9ca3af]">
            {rows.length} {pluralRu(rows.length, ['сотрудник', 'сотрудника', 'сотрудников'])}
          </div>
        )}
      </div>

      <CreateEmployeeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          void reload();
          void invalidateStats();
        }}
      />

      <EmployeeDetailModal
        open={detailOpen}
        employee={selected}
        pending={pending}
        onClose={() => setDetailOpen(false)}
        onBlock={() => ask(selected && { kind: 'BLOCK', employee: selected })}
        onResetAccess={() => ask(selected && { kind: 'RESET', employee: selected })}
        onChangeRole={(role) => ask(selected && { kind: 'ROLE', employee: selected, role })}
        onUnblock={() => {
          if (selected) void run({ kind: 'UNBLOCK', employee: selected });
        }}
      />

      <ConfirmDialog
        open={confirm != null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void run(confirm);
        }}
        title={confirmed?.title ?? ''}
        message={confirmed?.message ?? ''}
        confirmLabel={confirmed?.confirmLabel ?? 'Подтвердить'}
        danger={confirm?.kind === 'BLOCK'}
        loading={pending}
      />

      <IssuedCodeModal
        open={issuedCode != null}
        code={issuedCode?.code ?? null}
        employeeName={issuedCode?.name ?? ''}
        onClose={() => setIssuedCode(null)}
      />
    </div>
  );
}

/**
 * Действие, требующее подтверждения (ТЗ SERVICE-FE-004 §11).
 *
 * Одним объединением, а не тремя флагами: одновременно ждать подтверждения могут не два
 * действия, а ровно одно, и три независимых состояния позволили бы обратное.
 */
type PendingAction =
  | { kind: 'UNBLOCK'; employee: PlatformUser }
  | { kind: 'BLOCK'; employee: PlatformUser }
  | { kind: 'ROLE'; employee: PlatformUser; role: EmployeeRole }
  | { kind: 'RESET'; employee: PlatformUser };

/**
 * Текст подтверждения говорит о последствии, а не о названии кнопки: у блокировки и
 * смены роли последствие одно и то же — заявки уходят обратно в очередь, — и человек
 * должен узнать об этом до нажатия, а не из обновившегося списка.
 */
function confirmText(action: PendingAction): {
  title: string;
  message: string;
  confirmLabel: string;
} {
  const name = action.employee.fullName;
  switch (action.kind) {
    case 'BLOCK':
      return {
        title: `Заблокировать ${name}?`,
        message:
          'Сотрудник перестанет входить в приложение, а заявки, которые сейчас у него в работе, вернутся в очередь его службы. Новые, выполненные и отменённые заявки не изменятся.',
        confirmLabel: 'Заблокировать',
      };
    case 'ROLE':
      return {
        title: `Сменить роль на «${EMPLOYEE_ROLE_LABELS[action.role]}»?`,
        message: `${name} перейдёт в другую службу. Заявки, которые сейчас у него в работе и больше не подходят по службе, вернутся в очередь. Новые, выполненные и отменённые заявки не изменятся.`,
        confirmLabel: 'Сменить роль',
      };
    case 'RESET':
      return {
        title: `Сбросить доступ ${name}?`,
        message:
          'Текущий пароль перестанет работать, сотрудника выкинет из приложения. Новый код активации показывается один раз — передайте его лично. Заявки сотрудника при этом не меняются.',
        confirmLabel: 'Сбросить доступ',
      };
    case 'UNBLOCK':
      return {
        title: `Разблокировать ${name}?`,
        message: 'Сотрудник снова сможет входить в приложение.',
        confirmLabel: 'Разблокировать',
      };
  }
}
