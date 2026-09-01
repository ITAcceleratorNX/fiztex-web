import { AlertTriangle } from 'lucide-react';
import { cx } from '@/lib/format';
import type { ServiceRequestStatus } from '@/lib/serviceRequestsApi';
import { statusChip, type StatusTone } from '@/lib/serviceRequestsModel';

/**
 * Чип статуса заявки (Figma «Заявки — Мои заявки»).
 *
 * Тон приходит из `statusChip`, цвет берётся здесь: экран не должен знать, каким классом
 * покрашена «Выполнена», а модель — какими цветами вообще располагает панель.
 */
const TONES: Record<StatusTone, string> = {
  new: 'bg-info-bg text-link',
  progress: 'bg-amber-50 text-amber-700',
  done: 'bg-success-bg text-success-fg',
  cancelled: 'bg-red-50 text-red-600',
};

export function ServiceStatusChip({ status }: { status: ServiceRequestStatus | undefined }) {
  const chip = statusChip(status);
  if (!chip) return null;
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-11 font-semibold',
        TONES[chip.tone],
      )}
    >
      {chip.label}
    </span>
  );
}

/**
 * «Экстренная» — признак поверх статуса, а не пятый статус (SERVICE-DESIGN-001 §3).
 * Отдельным чипом, потому что срочность не отменяет того, дошла ли заявка до исполнителя.
 */
export function EmergencyChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-11 font-semibold text-amber-700">
      <AlertTriangle className="size-3" aria-hidden />
      Экстренная
    </span>
  );
}

/** Кем приходится смотрящий заявке: «Вы автор» / «Вы исполнитель». */
export function ViewerContextChip({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-info-bg px-2.5 py-1 text-11 font-semibold text-link">
      {label}
    </span>
  );
}
