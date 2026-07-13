import { useState } from 'react';
import { useAllowRetake, useAttemptLogs } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { eventLabel } from '@/lib/admissionEvents';
import { isFinalAttemptStatus } from '@/lib/admissionStatus';
import type { MonitoringAttemptItem } from '@/lib/types';

export function AttemptLogsModal({
  open,
  attempt,
  onClose,
}: {
  open: boolean;
  attempt: MonitoringAttemptItem | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const allowRetake = useAllowRetake();
  const [confirmRetake, setConfirmRetake] = useState(false);

  const attemptId = open && attempt?.attemptId != null ? attempt.attemptId : null;
  const logsQuery = useAttemptLogs(attemptId);

  const logs = logsQuery.data?.pages.flatMap((page) => page.content) ?? [];
  const hasMore = logsQuery.hasNextPage ?? false;

  const canAllowRetake =
    attempt != null &&
    isFinalAttemptStatus(attempt.status) &&
    !attempt.retakeAllowed;

  async function handleAllowRetake() {
    if (!attempt) return;
    try {
      await allowRetake.mutateAsync(attempt.assignmentId);
      toast.success('Повторная попытка разрешена');
      setConfirmRetake(false);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось разрешить повтор');
    }
  }

  const title = attempt
    ? `${attempt.applicantName} — ${attempt.testTitle}`
    : 'Логи попытки';

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={title}
        size="md"
        footer={
          canAllowRetake ? (
            <Button variant="primary" onClick={() => setConfirmRetake(true)}>
              Разрешить повторную попытку
            </Button>
          ) : undefined
        }
      >
        {attempt?.retakeAllowed && (
          <p className="mb-4 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-700 ring-1 ring-violet-200">
            Повторная попытка уже разрешена — поступающий может начать тест заново.
          </p>
        )}

        {logsQuery.isLoading ? (
          <LoadingBlock label="Загрузка логов…" />
        ) : logsQuery.isError ? (
          <ErrorBlock
            message={
              logsQuery.error instanceof ApiError
                ? logsQuery.error.message
                : 'Не удалось загрузить логи'
            }
            onRetry={() => logsQuery.refetch()}
          />
        ) : logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Событий пока нет</p>
        ) : (
          <ul className="space-y-2">
            {logs.map((log, idx) => (
              <li
                key={`${log.occurredAt}-${log.type}-${idx}`}
                className="rounded-xl border border-slate-100 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">{eventLabel(log.type)}</span>
                  <span className="text-xs text-slate-400">{formatDateTime(log.occurredAt)}</span>
                </div>
                {log.details && (
                  <p className="mt-1 text-xs text-slate-500">{log.details}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Button
              size="sm"
              variant="secondary"
              loading={logsQuery.isFetchingNextPage}
              onClick={() => logsQuery.fetchNextPage()}
            >
              Показать ещё
            </Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmRetake}
        onClose={() => setConfirmRetake(false)}
        onConfirm={handleAllowRetake}
        title="Разрешить повторную попытку?"
        message={
          <>
            Текущие ответы и логи первой попытки останутся в истории. Поступающий сможет начать
            тест заново со своего экрана.
          </>
        }
        confirmLabel="Разрешить"
        loading={allowRetake.isPending}
      />
    </>
  );
}
