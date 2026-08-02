import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { createUser } from '../services';
import { formatPhoneMask, isPhoneComplete } from './createUserHelpers';
import { IssuedCodeResult } from './IssuedCodeResult';

/**
 * Аккаунт учителя. В форме только то, что уходит на бэкенд (`POST /admin/accounts`).
 *
 * Предметов здесь нет: связка учитель↔предмет↔класс — это назначение
 * (`/admin/teacher-assignments`), которому нужны ещё класс и учебный год.
 * Заводится в профиле учителя, кнопкой «+ Назначить класс».
 */
export function CreateTeacherModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFullName('');
    setPhone('');
    setEmail('');
    setError(null);
    setIssuedCode(null);
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError('Укажите ФИО');
      return;
    }
    if (!isPhoneComplete(phone)) {
      setError('Укажите телефон');
      return;
    }

    setPending(true);
    try {
      const created = await createUser({
        fullName: fullName.trim(),
        role: 'TEACHER',
        phone: phone.trim(),
        email: email.trim() || undefined,
      });

      onSaved();
      if (created.issuedCode) {
        setIssuedCode(created.issuedCode);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать учителя');
    } finally {
      setPending(false);
    }
  }

  function handleDone() {
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleDone}
      title={issuedCode ? 'Учитель создан' : 'Создать учителя'}
      subtitle={
        issuedCode
          ? 'Передайте код учителю для активации в мобильном приложении'
          : 'Предметы и классы назначаются в профиле учителя после создания'
      }
      footer={
        issuedCode ? undefined : (
          <div className="flex w-full items-center justify-between gap-3">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Отмена
            </Button>
            <Button onClick={onSubmit} loading={pending}>
              Создать
            </Button>
          </div>
        )
      }
    >
      {issuedCode ? (
        <IssuedCodeResult
          roleLabel="учитель"
          code={issuedCode}
          hint="Учитель вводит телефон, этот код и новый пароль (≥8 символов) при первом входе. Предметы и классы назначьте в профиле учителя."
          onDone={handleDone}
        />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="ФИО" required>
            <TextInput
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Васильева Анна Ивановна"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Телефон" required>
              <TextInput
                value={phone}
                onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
                placeholder="+7 (777) 987-65-43"
                inputMode="tel"
                required
              />
            </Field>
            <Field label="Email">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@phystech.edu"
              />
            </Field>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
