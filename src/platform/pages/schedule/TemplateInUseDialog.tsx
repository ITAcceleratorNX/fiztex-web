import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import type { TemplateUsage } from '@/lib/scheduleSettingsTypes';

function usageFromError(error: ApiError): TemplateUsage | null {
  const details = error.details;
  if (!details || typeof details !== 'object') return null;
  const record = details as Record<string, unknown>;
  const bindings = typeof record.bindings === 'number' ? record.bindings : 0;
  const draftSchedules = typeof record.draftSchedules === 'number' ? record.draftSchedules : 0;
  const publishedSchedules =
    typeof record.publishedSchedules === 'number' ? record.publishedSchedules : 0;
  return { bindings, draftSchedules, publishedSchedules, classNames: [] };
}

export function TemplateInUseDialog({
  open,
  error,
  usageFallback,
  loading,
  onCancel,
  onConfirmImpact,
  onCopy,
}: {
  open: boolean;
  error: ApiError | null;
  /** Prefer live usage query when dialog opens from banner path without details. */
  usageFallback?: TemplateUsage | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirmImpact: () => void;
  onCopy: () => void;
}) {
  const usage = (error ? usageFromError(error) : null) ?? usageFallback ?? null;
  const isPublished = error?.code === 'BELL_TEMPLATE_IN_USE_PUBLISHED';
  const drafts = usage?.draftSchedules ?? 0;
  const published = usage?.publishedSchedules ?? 0;
  const bindings = usage?.bindings ?? 0;

  const message = isPublished
    ? `Шаблон используется в опубликованных расписаниях (${published}). Изменение сетки затронет их. Рекомендуем создать копию.`
    : `Шаблон используется в черновиках расписаний (${drafts}). Изменение сетки затронет их.`;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Шаблон используется"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Отмена
          </Button>
          <Button variant="secondary" onClick={onConfirmImpact} loading={loading}>
            Изменить всё равно
          </Button>
          <Button
            variant="primary"
            onClick={onCopy}
            loading={loading}
            className={!isPublished ? 'order-first sm:order-none' : undefined}
          >
            Создать копию
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
      <ul className="mt-3 space-y-1 text-sm text-slate-500">
        <li>Классов с привязкой: {bindings}</li>
        <li>Черновиков: {drafts}</li>
        <li>Опубликованных: {published}</li>
      </ul>
      {isPublished && (
        <p className="mt-3 text-xs text-amber-700">
          Для опубликованных расписаний безопаснее работать с копией шаблона.
        </p>
      )}
    </Modal>
  );
}
