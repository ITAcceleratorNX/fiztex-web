import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import { createParentWithAccount } from '../services';

const PHONE_RE = /^\+?[0-9\s()-]{10,18}$/;

export function CreateParentModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName('');
    setPhone('');
    setError(null);
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError('Укажите ФИО');
      return;
    }
    if (!phone.trim() || !PHONE_RE.test(phone.trim())) {
      setError('Укажите корректный телефон');
      return;
    }
    setPending(true);
    try {
      const result = await createParentWithAccount({ fullName, phone });
      toast.success(
        result.issuedCode
          ? `Родитель создан. Код: ${result.issuedCode}`
          : 'Родитель создан',
      );
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Создать родителя"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            Создать
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="ФИО" required hint="Фамилия Имя Отчество">
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label="Телефон" required>
          <TextInput
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+77001112233"
            required
          />
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
