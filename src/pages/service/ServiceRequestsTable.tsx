import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { cx, formatDate } from '@/lib/format';
import type { ServiceRequest } from '@/lib/serviceRequestsApi';
import { locationLine, serviceTypeLabel, eventAt, viewerContext } from '@/lib/serviceRequestsModel';
import { EmergencyChip, ServiceStatusChip, ViewerContextChip } from './ServiceStatusChip';
import { ServicePhotoCell } from './ServicePhoto';

const COLUMNS = [
  { key: 'request', label: 'Заявка', className: 'w-40' },
  { key: 'location', label: 'Местонахождение', className: 'w-64' },
  { key: 'description', label: 'Краткое описание', className: 'w-auto' },
  { key: 'type', label: 'Тип заявки', className: 'w-36' },
  { key: 'status', label: 'Статус', className: 'w-52' },
  { key: 'photo', label: 'Фото', className: 'w-24' },
  { key: 'action', label: 'Действие', className: 'w-32 text-right' },
] as const;

const HEAD_CELL = 'px-5 py-3 text-left text-10 font-medium uppercase tracking-wide text-subtle';
const CELL = 'px-5 py-4 align-middle text-13 text-ink';

/**
 * Список заявок автора (Figma «Заявки — Мои заявки» / «Заявки — История»).
 *
 * Одна таблица на оба раздела: строка в них одна и та же (§5), а различаются они только
 * набором статусов — и его задаёт сервер, а не разбор пришедшей страницы.
 *
 * Порядок строк приходит готовым и здесь не пересортировывается: он склеен из двух выдач
 * по статусу и уже приведён к «свежие сверху» в `useServiceRequests`.
 */
export function ServiceRequestsTable({
  rows,
  accountId,
}: {
  rows: ServiceRequest[];
  accountId: number | undefined;
}) {
  const navigate = useNavigate();

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full border-collapse">
        <thead className="border-b border-line bg-neutral-bg/40">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className={cx(HEAD_CELL, column.className)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0 hover:bg-neutral-bg/30">
              <td className={CELL}>
                <span className="block font-semibold text-link">{row.requestNumber}</span>
                <span className="block text-11 text-subtle">{formatDate(eventAt(row))}</span>
              </td>

              <td className={cx(CELL, 'text-ink')}>{locationLine(row) || '—'}</td>

              {/* Описание обрезается строкой, а не тремя точками в данных: полный текст
                  живёт на детальной странице, и хранить его укороченным здесь незачем. */}
              <td className={cx(CELL, 'max-w-0 truncate')} title={row.description}>
                {row.description}
              </td>

              <td className={CELL}>
                <span className="inline-flex items-center rounded bg-neutral-bg px-2 py-1 text-11 font-medium text-ink">
                  {serviceTypeLabel(row.serviceType)}
                </span>
              </td>

              <td className={CELL}>
                <span className="flex flex-wrap items-center gap-1.5">
                  <ServiceStatusChip status={row.status} />
                  {row.emergency && <EmergencyChip />}
                  <ViewerContextChip label={viewerContext(row, accountId)} />
                </span>
              </td>

              <td className={CELL}>
                <ServicePhotoCell requestId={row.id as number} photos={row.photos ?? []} />
              </td>

              <td className={cx(CELL, 'text-right')}>
                <Button variant="secondary" onClick={() => navigate(`/service/${row.id}`)}>
                  Открыть
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Скелет таблицы: строки известной высоты не дают странице прыгнуть, когда придут данные. */
export function ServiceRequestsTableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full border-collapse">
        <thead className="border-b border-line bg-neutral-bg/40">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className={cx(HEAD_CELL, column.className)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, index) => (
            <tr key={index} className="border-b border-line last:border-0">
              {COLUMNS.map((column) => (
                <td key={column.key} className={CELL}>
                  <span className="block h-4 w-full max-w-32 animate-pulse rounded bg-neutral-bg" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
