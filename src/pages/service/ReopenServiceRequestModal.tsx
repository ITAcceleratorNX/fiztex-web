import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useReopenServiceRequest } from '@/hooks/queries';
import { actionErrorText } from '@/lib/serviceRequestsModel';

/**
 * Возврат выполненной заявки в работу (ТЗ SERVICE-FE-001 §8, Figma «Заявка №1035 —
 * Вернуть в работу»).
 *
 * Отдельное окно, а не подтверждение: §8 требует обязательную причину, и кнопка не
 * включается, пока её не написали. Узнать об отсутствии причины от сервера было бы
 * поздно — окно к тому моменту уже закрылось бы.
 *
 * Исполнителя здесь не выбирают и службу не меняют: кому достанется заявка и в каком она
 * окажется статусе, решает бэкенд, а экран показывает то, что он вернул.
 */
export function ReopenServiceRequestModal({
  open,
  requestId,
  onClose,
  onDone,
}: {
  open: boolean;
  requestId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const reopen = useReopenServiceRequest();
  const [comment, setComment] = useState('');

  // Закрытое окно не хранит ни текста, ни прошлого отказа: следующий возврат начинается
  // с чистого листа. Зависимость только от `open` — объект мутации новый на каждый рендер.
  const { reset } = reopen;
  useEffect(() => {
    if (open) return;
    setComment('');
    reset();
  }, [open, reset]);

  async function submit() {
    await reopen.mutateAsync({ id: requestId, comment: comment.trim() });
    onDone();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Вернуть заявку в работу"
      subtitle="Опишите, что осталось не сделано"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="secondary" onClick={onClose} disabled={reopen.isPending}>
            Отмена
          </Button>
          <Button
            onClick={() => void submit()}
            loading={reopen.isPending}
            disabled={comment.trim().length === 0}
          >
            Вернуть в работу
          </Button>
        </div>
      }
    >
      <Field label="Комментарий" required error={reopen.isError ? actionErrorText(reopen.error) : undefined}>
        <TextArea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Что нужно исправить?"
          maxLength={1000}
          rows={4}
          error={reopen.isError}
        />
      </Field>
    </Modal>
  );
}
