import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field';
import { createUser } from '../services';
import { formatPhoneMask, isPhoneComplete } from './createUserHelpers';
import { IssuedCodeResult } from './IssuedCodeResult';

/**
 * Создание сотрудника охраны.
 *
 * Отдельная модалка, а не роль в списке администратора: у них расходится и обязательный
 * набор полей, и то, куда человек потом пойдёт с кодом. Админ активируется в веб-админке
 * и без почты туда не войдёт; охранник активируется в мобильном приложении и почты, как
 * правило, вовсе не имеет — телефона достаточно (SERVICE-BE-002 §2).
 *
 * Школьного профиля роль не заводит: ни класса, ни предмета у неё нет, и `classId` сюда
 * не передаётся.
 */
export function CreateSecurityModal({
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
    // Телефон обязателен, почта — нет: по телефону охранник и активируется, и входит.
    if (!isPhoneComplete(phone)) {
      setError('Укажите телефон');
      return;
    }

    setPending(true);
    try {
      const created = await createUser({
        fullName: fullName.trim(),
        role: 'SECURITY',
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
      setError(err instanceof Error ? err.message : 'Не удалось создать сотрудника охраны');
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
      title={issuedCode ? 'Сотрудник охраны создан' : 'Создать сотрудника охраны'}
      subtitle={
        issuedCode
          ? 'Передайте код для активации в мобильном приложении'
          : 'Учётная запись для подачи сервисных заявок с телефона'
      }
      footer={
        issuedCode ? undefined : (
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
          roleLabel="охрана"
          code={issuedCode}
          hint="В приложении: «Родитель / сотрудник» → «Активация» → «Сотрудник». Охранник вводит телефон, этот код и новый пароль (≥8 символов)."
          onDone={handleDone}
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
            <Field label="Телефон" required>
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
            <Select value="SECURITY" onChange={() => {}} disabled>
              <option value="SECURITY">Охрана</option>
            </Select>
          </Field>

          <Field label="Комментарий">
            <TextArea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Пост, смена, зона ответственности..."
              rows={3}
            />
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
