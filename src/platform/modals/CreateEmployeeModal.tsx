import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, Select } from '@/components/ui/Field';
import {
  EMPLOYEE_ROLES,
  EMPLOYEE_ROLE_LABELS,
  canUnblock,
  employeeState,
  isEmployeeRole,
  type EmployeeRole,
} from '@/lib/employeesModel';
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS } from '../labels';
import { createUser, findAccountByPhone, setAccountActive } from '../services';
import type { PlatformUser } from '../types';
import { formatPhoneMask, isPhoneComplete, normalizedPhone } from './createUserHelpers';
import { IssuedCodeResult } from './IssuedCodeResult';

/**
 * Создание внутреннего сотрудника: клининг, техслужба, охрана (ТЗ SERVICE-FE-004 §3, §4).
 *
 * Одна модалка на три роли, а не три похожих: набор полей у них общий, различается
 * только значение в поле «Роль». Школьного профиля они не заводят — ни класса, ни
 * предмета у этих ролей нет, — поэтому `classId` сюда не передаётся.
 *
 * **Телефон уникален, и дубля быть не должно (§4).** Занятый номер проверяется до
 * создания, а не по отказу: бэкенд отвечает голым 409 без кода, и сценарий возврата,
 * привязанный к тексту сообщения, ломался бы от правки формулировки. Найденный
 * заблокированный сотрудник поэтому не ошибка, а второй шаг того же действия: тот же
 * аккаунт разблокируется, а новый не создаётся.
 */
export function CreateEmployeeModal({
  open,
  role: fixedRole,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Заданная роль — поле «Роль» тогда не выбирается. */
  role?: EmployeeRole;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<EmployeeRole>(fixedRole ?? 'CLEANING');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  /** Найденный владелец телефона — экран занятого номера вместо формы (§4). */
  const [conflict, setConflict] = useState<PlatformUser | null>(null);

  useEffect(() => {
    if (!open) return;
    setRole(fixedRole ?? 'CLEANING');
    setFullName('');
    setPhone('');
    setEmail('');
    setError(null);
    setIssuedCode(null);
    setConflict(null);
  }, [open, fixedRole]);

  const roleLabel = EMPLOYEE_ROLE_LABELS[role];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError('Укажите ФИО');
      return;
    }
    // Телефон обязателен, почта — нет: по телефону сотрудник и активируется, и входит.
    if (!isPhoneComplete(phone)) {
      setError('Укажите телефон');
      return;
    }

    setPending(true);
    try {
      const taken = await findAccountByPhone(normalizedPhone(phone));
      if (taken) {
        setConflict(taken);
        return;
      }

      const created = await createUser({
        fullName: fullName.trim(),
        role,
        phone: phone.trim(),
        email: email.trim() || undefined,
      });

      onSaved();
      if (created.issuedCode) setIssuedCode(created.issuedCode);
      else onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать сотрудника');
    } finally {
      setPending(false);
    }
  }

  /** §4: заблокированный аккаунт с этим телефоном возвращается в строй, а не дублируется. */
  async function onUnblockExisting() {
    if (!conflict) return;
    setPending(true);
    setError(null);
    try {
      await setAccountActive(conflict.id, true);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось разблокировать сотрудника');
    } finally {
      setPending(false);
    }
  }

  /**
   * Разблокировать отсюда можно только сотрудника: телефон мог достаться заблокированному
   * учителю или родителю, и возвращать их в строй из этого раздела значило бы управлять
   * чужим.
   */
  const unblockable =
    conflict != null && isEmployeeRole(conflict.role) && canUnblock(conflict.status);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        issuedCode
          ? 'Сотрудник создан'
          : conflict
            ? 'Телефон уже занят'
            : fixedRole
              ? `Создать сотрудника: ${roleLabel.toLowerCase()}`
              : 'Создать сотрудника'
      }
      subtitle={
        issuedCode
          ? 'Передайте код для активации в мобильном приложении'
          : conflict
            ? undefined
            : 'Учётная запись для работы с сервисными заявками с телефона'
      }
      footer={
        issuedCode ? undefined : conflict ? (
          <div className="flex w-full items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setConflict(null)} disabled={pending}>
              Изменить телефон
            </Button>
            {unblockable && (
              <Button onClick={() => void onUnblockExisting()} loading={pending}>
                Разблокировать сотрудника
              </Button>
            )}
          </div>
        ) : (
          <div className="flex w-full items-center justify-between gap-3">
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Отмена
            </Button>
            <Button onClick={onSubmit} loading={pending}>
              Создать сотрудника
            </Button>
          </div>
        )
      }
    >
      {issuedCode ? (
        <IssuedCodeResult
          roleLabel={roleLabel.toLowerCase()}
          code={issuedCode}
          hint="В приложении: «Родитель / сотрудник» → «Активация» → «Сотрудник». Сотрудник вводит телефон, этот код и новый пароль (≥8 символов)."
          onDone={onClose}
        />
      ) : conflict ? (
        <PhoneTakenBlock
          user={conflict}
          unblockable={unblockable}
          wantedRole={role}
          error={error}
        />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="ФИО" required>
            <TextInput
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Оспанов Ерлан Маратович"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Телефон" required hint="По нему сотрудник входит в приложение">
              <TextInput
                value={phone}
                onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
                placeholder="+7 (701) 987-65-43"
                inputMode="tel"
                required
              />
            </Field>
            <Field label="Email">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Необязательно"
              />
            </Field>
          </div>

          <Field label="Роль" required>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as EmployeeRole)}
              disabled={Boolean(fixedRole)}
            >
              {EMPLOYEE_ROLES.map((value) => (
                <option key={value} value={value}>
                  {EMPLOYEE_ROLE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      )}
    </Modal>
  );
}

/**
 * Занятый телефон (§4).
 *
 * Показываем не «ошибку валидации», а найденного человека: решение зависит от того, кто
 * это. Заблокированного возвращают в строй той же кнопкой; действующему сотруднику
 * новый аккаунт не нужен вовсе, и предлагать разблокировку было бы бессмысленно.
 */
function PhoneTakenBlock({
  user,
  unblockable,
  wantedRole,
  error,
}: {
  user: PlatformUser;
  unblockable: boolean;
  /** Роль, которую выбирали в форме — чтобы предупредить, если у аккаунта она другая. */
  wantedRole: EmployeeRole;
  error: string | null;
}) {
  const roleDiffers = unblockable && user.role !== wantedRole;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl bg-amber-50 p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
        <p className="text-13 leading-relaxed text-amber-900">
          {unblockable
            ? 'Этот телефон уже принадлежит заблокированному сотруднику. Новый аккаунт не создаётся — вместо этого разблокируется существующий.'
            : !isEmployeeRole(user.role)
              ? 'Этот телефон принадлежит аккаунту другой роли. Управлять им нужно в общем разделе «Пользователи».'
              : employeeState(user.status) === 'INACTIVE'
                  ? 'Этот телефон принадлежит аккаунту в архиве. Вернуть его этой кнопкой нельзя — освободите номер или укажите другой.'
                : 'Этот телефон уже принадлежит действующему аккаунту. Второй с тем же номером завести нельзя.'}
        </p>
      </div>

      {/* Роль вернётся та, что была: сменить её нечем — у бэкенда нет правки аккаунта. */}
      {roleDiffers && (
        <p className="text-13 leading-relaxed text-amber-900">
          Вы выбирали «{EMPLOYEE_ROLE_LABELS[wantedRole]}», но у этого аккаунта роль «
          {EMPLOYEE_ROLE_LABELS[user.role as EmployeeRole]}». Он вернётся в прежней роли —
          сменить её можно в его карточке после разблокировки.
        </p>
      )}

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">ФИО</dt>
          <dd className="mt-1 font-medium text-slate-800">{user.fullName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Роль</dt>
          <dd className="mt-1 font-medium text-slate-800">{ROLE_LABELS[user.role]}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Телефон</dt>
          <dd className="mt-1 font-medium text-slate-800">{user.phone ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Статус</dt>
          <dd className="mt-1 font-medium text-slate-800">
            {ACCOUNT_STATUS_LABELS[user.status]}
          </dd>
        </div>
      </dl>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
