import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field';
import { createUser } from '../services';
import { formatPhoneMask, isPhoneComplete } from './createUserHelpers';
import { IssuedCodeResult } from './IssuedCodeResult';

export function CreateAdminModal({
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
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFullName('');
    setPhone('');
    setEmail('');
    setComment('');
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
    if (!email.trim()) {
      setError('Укажите email');
      return;
    }

    setPending(true);
    try {
      const created = await createUser({
        fullName: fullName.trim(),
        role: 'ADMIN',
        phone: phone.trim(),
        email: email.trim(),
      });

      onSaved();
      if (created.issuedCode) {
        setIssuedCode(created.issuedCode);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать администратора');
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
      title={issuedCode ? 'Администратор создан' : 'Создать администратора'}
      subtitle={
        issuedCode
          ? 'Передайте код для активации в веб-админке'
          : 'Создайте учётную запись администратора системы'
      }
      footer={
        issuedCode ? undefined : (
          <div className="flex w-full items-center justify-between gap-3">
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Отмена
            </Button>
            <Button onClick={onSubmit} loading={pending}>
              Создать администратора
            </Button>
          </div>
        )
      }
    >
      {issuedCode ? (
        <IssuedCodeResult
          roleLabel="администратор"
          code={issuedCode}
          hint="Админ вводит телефон или email, этот код и новый пароль (≥8 символов) при первом входе в веб."
          onDone={handleDone}
        />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="ФИО" required>
            <TextInput
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Петрова Алёна Владимировна"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Телефон" required>
              <TextInput
                value={phone}
                onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
                placeholder="+7 (701) 987-65-43"
                inputMode="tel"
                required
              />
            </Field>
            <Field label="Email" required>
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@phystech.edu"
                required
              />
            </Field>
          </div>

          <Field label="Роль" required>
            <Select value="ADMIN" onChange={() => {}} disabled>
              <option value="ADMIN">Администратор</option>
            </Select>
          </Field>

          <Field label="Комментарий">
            <TextArea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Уровень доступа, зона ответственности..."
              rows={3}
            />
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
