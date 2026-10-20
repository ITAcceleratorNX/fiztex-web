import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StatusNotice } from '@/components/ui/StatusNotice';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useKtpCommand, useKtpContext, useKtpRemovalPreview } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { ktpApi, type KtpRemovalTarget } from '@/lib/ktpApi';
import { ktpError } from './KtpShared';

export function KtpRemovalDialog({ target, onClose, onRemoved }: { target: KtpRemovalTarget; onClose: () => void; onRemoved?: () => void }) {
  const query = useKtpRemovalPreview(target);
  const context = useKtpContext(target.kind === 'plan');
  const removal = useKtpCommand(ktpApi.remove);
  const toast = useToast();
  const preview = query.data;
  const conflict = removal.error instanceof ApiError && removal.error.status === 409;
  const contextReady = target.kind !== 'plan' || context.isSuccess;
  const title = target.kind === 'plan' ? 'Удалить КТП?' : target.kind === 'version' ? 'Удалить версию КТП?' : 'Удалить загрузку КТП?';
  function close() { if (!removal.isPending) onClose(); }
  async function remove() {
    if (!preview?.allowed || !preview.previewFingerprint || !preview.revision || !contextReady || conflict) return;
    try {
      await removal.mutateAsync({ target, preview });
      toast.success(target.kind === 'plan' ? 'КТП удалён из рабочего списка' : target.kind === 'version' ? 'Версия КТП удалена из списка' : 'Загрузка КТП удалена');
      onRemoved?.(); onClose();
    } catch { /* Retain the same command key after an uncertain network response. */ }
  }
  return <Modal open onClose={close} title={title} size="planning" appearance="planning" scrollable footer={<>
    <Button variant="secondary" disabled={removal.isPending} onClick={close}>{conflict ? 'Закрыть и обновить данные' : 'Отмена'}</Button>
    {!conflict && <Button variant="danger" loading={removal.isPending} disabled={!preview?.allowed || !preview.previewFingerprint || !contextReady || query.isFetching} onClick={() => void remove()}>{removal.isError ? 'Повторить удаление' : 'Удалить'}</Button>}
  </>}><div className="space-y-4">
    <p className="break-words text-sm font-semibold text-planning-ink">{target.label}</p>
    {query.isPending ? <LoadingBlock label="Проверяем последствия удаления…" /> : query.isError ? <ErrorBlock message={ktpError(query.error)} onRetry={() => void query.refetch()} /> : preview && <>
      <StatusNotice tone={preview.allowed ? 'warning' : 'info'}>{preview.message}</StatusNotice>
      {target.kind === 'plan' && <>
        {context.isPending ? <LoadingBlock label="Загрузка классов…" /> : context.isError ? <ErrorBlock message={ktpError(context.error)} onRetry={() => void context.refetch()} /> : <p className="text-sm text-planning-muted">Классы: {preview.classIds?.map(id => context.data.assignments?.find(a => a.classId === id)?.className).filter(Boolean).join(', ')}</p>}
        <dl className="space-y-3 rounded-xl border border-planning-line p-4 text-13">
          <div className="flex justify-between gap-4"><dt className="text-planning-muted">Будущие уроки: темы КТП будут сняты</dt><dd className="shrink-0 font-bold">{preview.futureAutomaticLessons ?? 0}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-planning-muted">Уроки с сохранёнными темами</dt><dd className="shrink-0 font-bold">{preview.preservedLessons ?? 0}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-planning-muted">Из них с ручными изменениями</dt><dd className="shrink-0 font-bold">{preview.preservedManualLessons ?? 0}</dd></div>
        </dl>
      </>}
    </>}
    {removal.isError && <StatusNotice tone="error">{ktpError(removal.error)}{conflict && <p className="mt-2">Закройте окно и повторите удаление с актуальными данными.</p>}</StatusNotice>}
  </div></Modal>;
}
