import { Modal } from '@/components/ui/Modal';
import { IssuedCodeResult } from './IssuedCodeResult';

/**
 * Выданный код доступа отдельным окном (ТЗ SERVICE-FE-004 §3).
 *
 * Своим окном, а не строкой в тосте: код показывается один раз — дальше в базе лежит
 * только его хеш, — и уехавшее через пять секунд уведомление означало бы, что доступ
 * сотруднику придётся сбрасывать заново. Закрыть окно человек должен сам.
 */
export function IssuedCodeModal({
  open,
  code,
  employeeName,
  onClose,
}: {
  open: boolean;
  code: string | null;
  employeeName: string;
  onClose: () => void;
}) {
  if (!code) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый код доступа"
      subtitle={`${employeeName} — прежний пароль больше не работает`}
    >
      <IssuedCodeResult
        roleLabel="сотрудник"
        code={code}
        hint="В приложении: «Родитель / сотрудник» → «Активация» → «Сотрудник». Сотрудник вводит телефон, этот код и новый пароль (≥8 символов)."
        onDone={onClose}
      />
    </Modal>
  );
}
