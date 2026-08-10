import { Badge, type BadgeTone } from './Badge';
import type { AnnouncementStatus } from '@/lib/announcementsApi';

/**
 * Статус анонса (ТЗ §3.1). Подписи и тона заданы таблицей, а не цепочкой `if`:
 * новый статус — одна строка, и подпись гарантированно одна на всё приложение.
 */
const STATUSES: Record<AnnouncementStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: 'Черновик', tone: 'amber' },
  PUBLISHED: { label: 'Опубликован', tone: 'green' },
  HIDDEN: { label: 'Скрыт', tone: 'gray' },
};

export function AnnouncementStatusBadge({ status }: { status: AnnouncementStatus }) {
  const { label, tone } = STATUSES[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

export function announcementStatusLabel(status: AnnouncementStatus): string {
  return STATUSES[status].label;
}
