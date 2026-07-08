import { Badge } from './Badge';
import type { TestStatus } from '@/lib/types';

export function TestStatusBadge({ status }: { status: TestStatus }) {
  if (status === 'ACTIVE') {
    return (
      <Badge tone="green" dot>
        Активен
      </Badge>
    );
  }
  if (status === 'COMPLETED') {
    return (
      <Badge tone="blue" dot>
        Завершён
      </Badge>
    );
  }
  return (
    <Badge tone="amber" dot>
      Черновик
    </Badge>
  );
}
