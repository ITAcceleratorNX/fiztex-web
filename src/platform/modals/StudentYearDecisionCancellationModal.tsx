import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useCancelStudentYearDecision, useStudentYearDecisionCancellation } from '@/hooks/queries';
import type { Schema } from '@/lib/apiSchemas';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { StudentYearDecisionHistory } from '../components/StudentYearDecisionHistory';

export function StudentYearDecisionCancellationModal({ decision, onClose, onSaved }: {
  decision: Schema<'StudentYearDecision'>; onClose: () => void; onSaved: () => void;
}) {
  const preview = useStudentYearDecisionCancellation(decision.id ?? null);
  const command = useCancelStudentYearDecision();
  const toast = useToast();
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [reason, setReason] = useState('');
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = orderNumber.trim().length > 0 && orderDate.length > 0 && reason.trim().length >= 5;
  const canSubmit = preview.data?.canCancel === true && !preview.isFetching && valid;
  function close() { if (!command.isPending) onClose(); }

  async function submit() {
    if (!canSubmit || decision.id == null) return;
    setError(null);
    try {
      await command.mutateAsync({ decisionId: decision.id, body: {
        expectedDecisionId: decision.id, orderNumber: orderNumber.trim(), orderDate, reason: reason.trim(),
      } });
      toast.success('Решение отменено. История и состав класса обновлены');
      onSaved(); onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Не удалось отменить решение');
      setReview(false);
      void preview.refetch();
    }
  }

  return <Modal open onClose={close} title={review ? 'Подтвердить отмену решения?' : 'Отмена перевода или выпуска'}
    subtitle={decision.studentName} size="lg" scrollable footer={<div className="flex justify-end gap-3">
      <Button variant="secondary" disabled={command.isPending} onClick={() => review ? setReview(false) : close()}>
        {review ? 'Назад' : 'Закрыть'}
      </Button>
      <Button variant={review ? 'danger' : 'primary'} disabled={!canSubmit || command.isPending}
        loading={command.isPending} onClick={() => review ? void submit() : setReview(true)}>
        {review ? 'Отменить решение по приказу' : 'Проверить отмену'}
      </Button>
    </div>}>
    <div className="space-y-5">
      <p className="text-13 text-muted">Отменяется только указанное решение. Исходный приказ, оценки и история сохранятся. После отмены решение для этого ученика можно оформить заново.</p>
      <StudentYearDecisionHistory decisions={[decision]} />
      {preview.isPending ? <LoadingBlock label="Проверка возможности отмены…" /> : preview.isError
        ? <ErrorBlock message="Не удалось проверить возможность отмены" onRetry={() => void preview.refetch()} />
        : <>
          {(preview.data?.blockers?.length ?? 0) > 0 && <div role="status" className="rounded-lg bg-warning-bg p-4 text-13 text-warning-fg">
            <p className="font-semibold">Перед отменой:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">{preview.data?.blockers?.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => void preview.refetch()}>Проверить снова</Button>
          </div>}
          {(preview.data?.effects?.length ?? 0) > 0 && <div className="rounded-lg bg-info-bg p-4 text-13 text-info-fg">
            <p className="font-semibold">Что изменится:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">{preview.data?.effects?.map(effect => <li key={effect}>{effect}</li>)}</ul>
          </div>}
          {review ? <div className="space-y-2 rounded-lg border border-line p-4 text-13">
            <p className="font-semibold text-ink">Приказ об отмене № {orderNumber} от {formatDate(orderDate)}</p>
            <p>{reason}</p>
            <p className="text-muted">Проверьте ученика, исходное решение и изменения состава до подтверждения. Приказ и автор отмены сохранятся в истории.</p>
          </div> : <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Номер приказа об отмене" required><TextInput value={orderNumber} maxLength={160}
                disabled={command.isPending} onChange={event => setOrderNumber(event.target.value)} /></Field>
              <Field label="Дата приказа об отмене" required><TextInput type="date" value={orderDate} min={decision.orderDate}
                disabled={command.isPending} onChange={event => setOrderDate(event.target.value)} /></Field>
            </div>
            <Field label="Причина отмены" required hint="Укажите ошибку и основание для отмены, не менее 5 знаков.">
              <TextArea value={reason} maxLength={2000} disabled={command.isPending} onChange={event => setReason(event.target.value)} />
            </Field>
          </div>}
        </>}
      {error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{error}</p>}
    </div>
  </Modal>;
}
