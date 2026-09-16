import { Lock, LockOpen } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { FeedbackMonth } from '@/lib/monthlyFeedbackApi';
import { closeHint } from '@/lib/monthlyFeedbackModel';

/**
 * Состояние отчётного месяца и его закрытие (Figma `period-open-badge` 2162:2088, 2162:2889).
 *
 * <p>В макете нарисовано окно «Закрыть период», но не кнопка, которая его открывает: без неё
 * флоу месяца не заканчивается. Кнопка стоит рядом с бейджем и неактивна, пока сервер не
 * разрешит закрытие (`canClose` — опубликованы все листы месяца); сколько осталось, подсказка
 * говорит числом, чтобы неактивная кнопка не выглядела сломанной.
 */
export function FeedbackPeriodControls({
  month,
  onClose,
}: {
  month: FeedbackMonth;
  onClose: () => void;
}) {
  if (month.closed) {
    return (
      <Badge icon={<Lock className="size-3.5" aria-hidden />}>Период закрыт</Badge>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge icon={<LockOpen className="size-3.5" aria-hidden />}>Период открыт</Badge>
      <Button variant="secondary" size="sm" disabled={!month.canClose} onClick={onClose}>
        Закрыть период
      </Button>
      {!month.canClose && <span className="text-13 text-muted">{closeHint(month.sheets)}</span>}
    </div>
  );
}
