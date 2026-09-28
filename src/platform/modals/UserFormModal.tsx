import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, focusFirstInvalidField, TextInput, Select } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { ROLE_LABELS } from '../labels';
import { createUser, updateUser } from '../services';
import type { AccountRole, AccountStatus, PlatformUser } from '../types';

const EDITABLE_ROLES: AccountRole[] = ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'];

const PHONE_RE = /^\+?[0-9\s()-]{10,18}$/;
type UserValidationField = 'fullName' | 'phone' | 'contact' | null;

export function UserFormModal({
  open,
  onClose,
  user,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  user: PlatformUser | null;
  onSaved: () => void;
}) {
  const isEdit = Boolean(user);
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AccountRole>('STUDENT');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<AccountStatus>('NOT_ACTIVATED');
  const [relationLabel, setRelationLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validationField, setValidationField] = useState<UserValidationField>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    setFullName(user?.fullName ?? '');
    setRole(user?.role && user.role !== 'SUPER_ADMIN' ? user.role : 'STUDENT');
    setEmail(user?.email ?? '');
    setPhone(user?.phone ?? '');
    setStatus(user?.status ?? 'NOT_ACTIVATED');
    setRelationLabel(user?.relationLabel ?? '');
    setError(null);
    setValidationField(null);
  }, [open, user]);

  useEffect(() => {
    if (focusRequest > 0) focusFirstInvalidField(formRef.current);
  }, [focusRequest]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setValidationField(null);
    if (!fullName.trim()) {
      setError('Укажите ФИО');
      setValidationField('fullName');
      setFocusRequest((request) => request + 1);
      return;
    }
    if (phone.trim() && !PHONE_RE.test(phone.trim())) {
      setError('Неверный формат телефона');
      setValidationField('phone');
      setFocusRequest((request) => request + 1);
      return;
    }
    if ((role === 'PARENT' || role === 'TEACHER' || role === 'ADMIN') && !phone.trim() && !email.trim()) {
      setError('Укажите телефон или email');
      setValidationField('contact');
      setFocusRequest((request) => request + 1);
      return;
    }

    setPending(true);
    try {
      if (isEdit && user) {
        await updateUser(user.id, {
          fullName,
          email,
          phone,
          status,
          relationLabel,
        });
        toast.success('Пользователь обновлён');
      } else {
        const created = await createUser({
          fullName,
          role,
          email,
          phone,
          status,
          relationLabel,
        });
        const profileHint =
          role === 'TEACHER' || role === 'PARENT' || role === 'STUDENT'
            ? ' Карточка в школе создана автоматически.'
            : '';
        if (created.issuedCode) {
          toast.success(`Пользователь создан.${profileHint} Код активации: ${created.issuedCode}`);
        } else {
          toast.success(`Пользователь создан.${profileHint}`);
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Редактировать пользователя' : 'Создать пользователя'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <Field
          label="ФИО"
          required
          hint={!isEdit ? 'Формат: Фамилия Имя Отчество — так заполняется карточка в школе' : undefined}
          error={validationField === 'fullName' ? error ?? undefined : undefined}
        >
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>

        {!isEdit && (
          <Field label="Роль" required>
            <Select value={role} onChange={(e) => setRole(e.target.value as AccountRole)}>
              {EDITABLE_ROLES.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Телефон"
            error={validationField === 'phone' || validationField === 'contact' ? error ?? undefined : undefined}
          >
            <TextInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+77001112233"
            />
          </Field>
          <Field label="Email" error={validationField === 'contact' ? error ?? undefined : undefined}>
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@school.kz"
            />
          </Field>
        </div>

        <Field label="Связи" hint="Класс ученика или дети родителя">
          <TextInput
            value={relationLabel}
            onChange={(e) => setRelationLabel(e.target.value)}
            placeholder="7А"
          />
        </Field>

        {isEdit && (
          <Field label="Статус">
            <Select value={status} onChange={(e) => setStatus(e.target.value as AccountStatus)}>
              <option value="NOT_ACTIVATED">Не активирован</option>
              <option value="ACTIVE">Активен</option>
              <option value="BLOCKED">Заблокирован</option>
              <option value="ARCHIVED">Архив</option>
            </Select>
          </Field>
        )}

        {error && !validationField && <p role="alert" className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
