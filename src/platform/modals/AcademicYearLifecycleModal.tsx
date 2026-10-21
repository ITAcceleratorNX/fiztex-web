import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useAcademicYearLifecycleCommand, useAcademicYearLifecycleHistory, useAcademicYearReadiness } from '@/hooks/queries';
import type { AcademicYear } from '@/platform/types';
import { YEAR_STATUS_LABELS } from '@/platform/labels';
import { ApiError } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

export type YearLifecycleAction = 'complete' | 'restore' | 'history';

export function AcademicYearLifecycleModal({ year, action, activeYear, onClose, onSaved }: {
  year: AcademicYear | null; action: YearLifecycleAction; activeYear: AcademicYear | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [reason, setReason] = useState('');
  const [makeActive, setMakeActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const readiness = useAcademicYearReadiness(action === 'complete' ? year?.id ?? null : null);
  const history = useAcademicYearLifecycleHistory(action === 'history' ? year?.id ?? null : null);
  const command = useAcademicYearLifecycleCommand();
  useEffect(() => { setReason(''); setMakeActive(false); setError(null); }, [year?.id, action]);

  async function submit() {
    if (!year) return;
    setError(null);
    try {
      await command.mutateAsync({ id: year.id, restore: action === 'restore'
        ? { reason: reason.trim(), makeActive, expectedActiveYearId: activeYear ? Number(activeYear.id) : undefined } : undefined });
      toast.success(action === 'restore' ? 'Учебный год восстановлен' : 'Учебный год завершён');
      onSaved(); onClose();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Не удалось выполнить действие. Обновите данные и повторите.');
      if (action === 'complete') void readiness.refetch();
    }
  }

  const title = action === 'complete' ? 'Проверка завершения года' : action === 'restore' ? 'Восстановление учебного года' : 'История учебного года';
  return <Modal open={year != null} onClose={() => { if (!command.isPending) onClose(); }} title={title} subtitle={year?.name}
    footer={action !== 'history' && <div className="flex justify-end gap-3">
      <Button variant="secondary" disabled={command.isPending} onClick={onClose}>Отмена</Button>
      <Button loading={command.isPending} disabled={action === 'complete' ? readiness.data?.canComplete !== true || readiness.isFetching : reason.trim().length < 5}
        onClick={() => void submit()}>{action === 'restore' ? 'Восстановить год' : 'Завершить и архивировать'}</Button>
    </div>}>
    {action === 'complete' && <>
      <p className="mb-4 text-13 text-muted">После завершения журнал останется доступен для чтения. Изменения потребуют отдельного восстановления года с записью причины в истории.</p>
      {readiness.isPending ? <LoadingBlock /> : readiness.isError ? <ErrorBlock message="Не удалось проверить готовность года" onRetry={() => void readiness.refetch()} />
        : readiness.data?.canComplete ? <p className="rounded-lg bg-success-bg p-4 text-13 text-success-fg">Проверка готовности пройдена. Можно завершить учебный год.</p>
        : <div className="rounded-lg bg-danger-bg p-4 text-13 text-danger-fg"><p className="font-semibold">Сначала завершите следующие процессы:</p><ul className="mt-2 list-disc space-y-2 pl-5">{readiness.data?.blockers?.map(item => <li key={item}>{item}</li>)}</ul></div>}
    </>}
    {action === 'restore' && <div className="flex flex-col gap-4">
      <p className="text-13 text-muted">Восстановление открывает год для исправлений. Прежние оценки, уроки и история сохраняются. Оформленные переводы и выпуск учеников сохраняются: восстановление года не отменяет эти решения. Укажите причину; действие и автор будут записаны в историю.</p>
      <label className="text-13 font-semibold text-ink">Причина восстановления<TextArea value={reason} disabled={command.isPending} onChange={event => setReason(event.target.value)} maxLength={1000} /></label>
      <Toggle checked={makeActive} disabled={command.isPending} onChange={setMakeActive} label="Сделать восстановленный год текущим"
        description={activeYear ? `Текущий «${activeYear.name}» вернётся в черновик, если в нём ещё нет уроков и итогов.` : 'Без этого переключателя год откроется как черновик для исправлений.'} />
    </div>}
    {action === 'history' && (history.isPending ? <LoadingBlock /> : history.isError ? <ErrorBlock message="Не удалось загрузить историю" onRetry={() => void history.refetch()} />
      : <div className="space-y-4"><p className="text-13 text-muted">Последние 100 действий. Старые операции, совершённые до включения истории, здесь не появятся.</p>
        {history.data?.length === 0 && <p className="text-13 text-muted">Записанных действий пока нет.</p>}
        {history.data?.map(event => <div key={event.id} className="border-b border-line pb-3 text-13">
          <p className="font-semibold">{event.action === 'RESTORE' ? 'Восстановление' : event.action === 'COMPLETE' ? 'Завершение' : 'Возврат в черновик'}</p>
          <p>{event.reason}</p><p className="text-muted">{YEAR_STATUS_LABELS[event.fromStatus as keyof typeof YEAR_STATUS_LABELS]} → {YEAR_STATUS_LABELS[event.toStatus as keyof typeof YEAR_STATUS_LABELS]} · {event.actorName ?? 'Сотрудник школы'} · {event.createdAt ? new Date(event.createdAt).toLocaleString('ru-RU') : ''}</p>
        </div>)}
      </div>)}
    {error && <p role="alert" className="mt-4 rounded-lg bg-danger-bg p-3 text-13 text-danger-fg">{error}</p>}
  </Modal>;
}
