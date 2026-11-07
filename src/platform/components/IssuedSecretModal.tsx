import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

/**
 * Выданное значение — персональный код, код восстановления, временный пароль (макет D6).
 *
 * Отдельное окно, а не тост: сервер отдаёт значение ровно один раз (в базе лежит хэш), и
 * показать его второй раз нельзя ни администратору, ни кому-либо ещё. Исчезающая плашка
 * для этого не годится — её закрывают, не успев прочитать, и восстановить нечем.
 *
 * Значение живёт только в этом окне: оно не попадает ни в адрес, ни в тост, ни в журнал.
 */
export function IssuedSecretModal({
  open,
  title,
  value,
  note,
  copyLabel = 'Скопировать',
  onClose,
}: {
  open: boolean;
  title: string;
  value: string | null;
  /** Строка под значением: что с ним произойдёт дальше. */
  note: string;
  copyLabel?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Буфер обмена может быть закрыт политикой браузера — значение остаётся на экране,
      // и его можно переписать руками. Ронять окно из-за этого нельзя.
      setCopied(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Передайте его лично. После закрытия окна значение больше не покажется."
      size="sm"
      footer={<Button className="w-full" onClick={onClose}>Готово</Button>}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
          <span className="select-all font-mono text-xl font-bold tracking-widest text-navy-700">
            {value ?? '—'}
          </span>
          <Button
            variant="secondary"
            size="sm"
            icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            onClick={() => void copy()}
          >
            {copied ? 'Скопировано' : copyLabel}
          </Button>
        </div>
        <p className="text-13 text-slate-500">{note}</p>
      </div>
    </Modal>
  );
}
