import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Schema } from '@/lib/apiSchemas';
import { formatDate } from '@/lib/format';
import { YEAR_DECISION_LABELS } from '@/lib/studentYearDecisionModel';

export function StudentYearDecisionHistory({ decisions, showStudent = false, onCancel }: {
  decisions: Schema<'StudentYearDecision'>[];
  showStudent?: boolean;
  onCancel?: (decision: Schema<'StudentYearDecision'>) => void;
}) {
  return <ol className="space-y-4">{decisions.map(decision => <li key={decision.id}
    className="space-y-2 rounded-lg border border-line p-4 text-13">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        {showStudent && <p className="font-semibold text-ink">{decision.studentName}</p>}
        <p className="text-muted">{decision.sourceClassName} · {decision.sourceYearName}</p>
        <p className="font-semibold text-ink">{YEAR_DECISION_LABELS[decision.decision ?? ''] ?? decision.decision}
          {decision.targetClassName ? ` · ${decision.targetClassName} · ${decision.targetYearName}` : ''}</p>
      </div>
      <Badge tone={decision.cancelled ? 'gray' : 'green'}>{decision.cancelled ? 'Отменено' : 'Действует'}</Badge>
    </div>
    <p>Приказ № {decision.orderNumber} от {formatDate(decision.orderDate)} · решение от {formatDate(decision.effectiveDate)}</p>
    <p className="text-muted">{decision.basis}</p>
    <p className="text-muted">Оформил: {decision.actorName ?? 'Сотрудник школы'}</p>
    {decision.cancellation && <div className="space-y-1 border-t border-line pt-3">
      <p className="font-semibold text-ink">Отмена: приказ № {decision.cancellation.orderNumber} от {formatDate(decision.cancellation.orderDate)}</p>
      <p>{decision.cancellation.reason}</p>
      <p className="text-muted">{decision.cancellation.actorName ?? 'Сотрудник школы'}
        {decision.cancellation.createdAt ? ` · ${new Date(decision.cancellation.createdAt).toLocaleString('ru-RU')}` : ''}</p>
    </div>}
    {onCancel && !decision.cancelled && decision.id != null && <Button variant="secondary" size="sm"
      onClick={() => onCancel(decision)}>Отменить решение</Button>}
  </li>)}</ol>;
}
