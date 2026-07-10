import { Badge } from './Badge';
import type { MaterialStatus } from '@/lib/types';

export function MaterialStatusBadge({ status }: { status: MaterialStatus }) {
  if (status === 'READY') {
    return (
      <Badge tone="green" dot>
        Готов
      </Badge>
    );
  }
  if (status === 'EXTRACTING') {
    return (
      <Badge tone="blue" dot>
        Извлечение…
      </Badge>
    );
  }
  if (status === 'EXTRACTION_FAILED') {
    return (
      <Badge tone="red" dot>
        Ошибка
      </Badge>
    );
  }
  return (
    <Badge tone="gray" dot>
      Загружен
    </Badge>
  );
}
