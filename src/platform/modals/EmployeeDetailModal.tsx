import { useEffect, useState } from 'react';
import { Info, KeyRound, Lock, Unlock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { formatDateTime } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import { useAssignedServiceRequests } from '@/hooks/queries';
import {
  ASSIGNEE_ROLES,
  EMPLOYEE_ROLE_LABELS,
  SERVICE_STAFF_ROLES,
  canBlock,
  canUnblock,
  employeeRoleLabel,
  isEmployeeRole,
  isServiceStaffRole,
  type EmployeeRole,
  type ServiceStaffRole,
} from '@/lib/employeesModel';
import { statusChip } from '@/lib/serviceRequestsModel';
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS } from '../labels';
import type { PlatformUser } from '../types';

/**
 * Карточка сотрудника (ТЗ SERVICE-FE-004 §3, §4).
 *
 * Кроме контактов показывает заявки, которые за ним сейчас числятся: без них ни
 * блокировка, ни смена роли не выглядят последствиями, а они возвращают его
 * `IN_PROGRESS` в очередь службы (SERVICE-BE-007 §9). Список читается тем же
 * административным эндпоинтом, что и раздел «Все заявки», и перечитывается после
 * действия — считать новое состояние на клиенте нельзя: решает бэкенд (§4).
 *
 * Окно ничего не решает само: все четыре действия уходят наружу колбэками, а
 * подтверждения и запросы живут на странице раздела. Здесь только выбор роли — он
 * черновой до нажатия «Сменить роль».
 */
export function EmployeeDetailModal({
  open,
  employee,
  onClose,
  onBlock,
  onUnblock,
  onChangeRole,
  onResetAccess,
  pending,
}: {
  open: boolean;
  employee: PlatformUser | null;
  onClose: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onChangeRole: (role: EmployeeRole) => void;
  onResetAccess: () => void;
  pending: boolean;
}) {
  const currentRole = isEmployeeRole(employee?.role) ? employee.role : null;
  const currentServiceStaffRole = isServiceStaffRole(currentRole) ? currentRole : null;
  const [role, setRole] = useState<ServiceStaffRole>(currentServiceStaffRole ?? 'CLEANING');

  // Черновой выбор сбрасывается при открытии и при смене сотрудника: иначе на карточке
  // следующего человека висела бы роль, выбранная для предыдущего.
  useEffect(() => {
    if (currentServiceStaffRole) setRole(currentServiceStaffRole);
  }, [currentServiceStaffRole, open]);

  const accountId = employee ? Number(employee.id) : null;
  // Заявки нужны только исполнительским ролям — психолог и охрана в эту очередь не входят
  // (SERVICE-BE-002; PSYCHOLOGIST-001 §1: разные профессии, разная очередь).
  const assignable = employee != null && (ASSIGNEE_ROLES as readonly string[]).includes(employee.role);
  const assigned = useAssignedServiceRequests(open && assignable ? accountId : null);

  if (!employee) return null;

  const blockable = canBlock(employee.status);
  const unblockable = canUnblock(employee.status);
  // Смена роли — только между тремя служебными (SERVICE-BE-008 §1): психологу это
  // не предложено вовсе, а не выключенной кнопкой — бэкенд его как источник/цель отклонит.
  // Роль архивного аккаунта менять нечего: бэкенд отвечает отказом, и предлагать это
  // значило бы обещать действие, которого не будет.
  const roleEditable = currentServiceStaffRole != null && employee.status !== 'ARCHIVED';
  const rows = assigned.data?.content ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={employee.fullName}
      subtitle={currentRole ? employeeRoleLabel(currentRole) : ROLE_LABELS[employee.role]}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Закрыть
          </Button>
          <Button
            variant="ghost"
            onClick={onResetAccess}
            disabled={pending}
            icon={<KeyRound className="size-4" />}
          >
            Сбросить доступ
          </Button>
          {unblockable && (
            <Button onClick={onUnblock} loading={pending} icon={<Unlock className="size-4" />}>
              Разблокировать
            </Button>
          )}
          {blockable && (
            <Button
              variant="danger"
              onClick={onBlock}
              loading={pending}
              icon={<Lock className="size-4" />}
            >
              Заблокировать
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Телефон</dt>
            <dd className="mt-1 font-medium text-slate-800">{employee.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt>
            <dd className="mt-1 font-medium text-slate-800">{employee.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Статус</dt>
            <dd className="mt-1 font-medium text-slate-800">
              {ACCOUNT_STATUS_LABELS[employee.status]}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Создан</dt>
            <dd className="mt-1 font-medium text-slate-800">{formatDateTime(employee.createdAt)}</dd>
          </div>
        </dl>

        {/* §3: смена роли между клинингом, техслужбой и охраной. Кнопка появляется только
            когда выбрана другая роль — «сменить на ту же» ничего не значит. */}
        {roleEditable && (
          <div className="flex items-end gap-3">
            <Field label="Роль">
              <Select
                value={role}
                onChange={(event) => setRole(event.target.value as ServiceStaffRole)}
                disabled={pending}
              >
                {SERVICE_STAFF_ROLES.map((value) => (
                  <option key={value} value={value}>
                    {EMPLOYEE_ROLE_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              variant="secondary"
              onClick={() => onChangeRole(role)}
              disabled={pending || role === currentServiceStaffRole}
            >
              Сменить роль
            </Button>
          </div>
        )}

        {assignable && (
          <section>
            <h3 className="label-base">Заявки в работе</h3>
            {assigned.isPending ? (
              <p className="text-13 text-slate-500">Загрузка заявок…</p>
            ) : assigned.isError ? (
              <p className="text-13 text-slate-500">Не удалось загрузить заявки сотрудника.</p>
            ) : rows.length === 0 ? (
              <p className="text-13 text-slate-500">Сейчас за сотрудником заявок не числится.</p>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center gap-2 text-13">
                    <Link
                      to={ROUTES.serviceRequest(row.id as number)}
                      className="font-semibold text-link hover:underline"
                    >
                      {row.requestNumber}
                    </Link>
                    <span className="text-slate-500">
                      {statusChip(row.status)?.label ?? '—'} · {row.description}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* §4: что произойдёт с этими заявками, решает и делает бэкенд. Экран об этом
            предупреждает, но сам не двигает ни одной заявки. */}
        <p className="flex gap-2 rounded-xl bg-info-bg px-3.5 py-3 text-13 leading-relaxed text-link">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Блокировка и смена роли возвращают в очередь только те заявки, что сейчас в
            работе у сотрудника и больше не подходят ему по службе. Новые, выполненные и
            отменённые не меняются.
          </span>
        </p>
      </div>
    </Modal>
  );
}
