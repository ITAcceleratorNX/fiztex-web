import { Badge } from './Badge';
import type { SurveyStatus } from '@/lib/surveyApi';
import { surveyStatusLabel } from '@/lib/surveyModel';

/** Тот же визуальный узор, что у `TestStatusBadge`, только для трёх статусов опроса. */
export function SurveyStatusBadge({ status }: { status: SurveyStatus | null | undefined }) {
  if (status === 'ACTIVE') {
    return (
      <Badge tone="green" dot>
        {surveyStatusLabel(status)}
      </Badge>
    );
  }
  if (status === 'COMPLETED') {
    return (
      <Badge tone="blue" dot>
        {surveyStatusLabel(status)}
      </Badge>
    );
  }
  return (
    <Badge tone="amber" dot>
      {surveyStatusLabel(status)}
    </Badge>
  );
}
