import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock } from '@/components/ui/StateBlock';
import { useServiceAudit } from '@/hooks/queries';
import { cx, formatDateTime } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import {
  AUDIT_PAGE_SIZE,
  EMPTY_AUDIT_FILTER,
  hasActiveAuditFilters,
  type AuditFilter,
  type ServiceRequestAuditEntry,
} from '@/lib/serviceRequestsAdminApi';
import type { ServiceRequestAction, ServiceRequestPhoto } from '@/lib/serviceRequestsApi';
import {
  HISTORY_ACTIONS,
  actionErrorText,
  historyEventLabel,
  serviceTypeLabel,
  stateChanges,
} from '@/lib/serviceRequestsModel';
import { AccountPicker, type PickedAccount } from '@/platform/components/AccountPicker';
import { Pager } from './Pager';
import { ServicePhotoThumb, ServicePhotoViewer } from './ServicePhoto';
import { ServiceStatusChip } from './ServiceStatusChip';

/**
 * Глобальный журнал действий — раздел Super Admin (ТЗ SERVICE-FE-004 §9).
 *
 * Read-only и по устройству, а не по решению экрана: у `/api/admin/service-requests/audit`
 * нет ни `POST`, ни `PATCH`, ни `DELETE`, и редактировать здесь попросту нечего.
 *
 * Каждое событие ведёт в свою заявку: журнал отвечает на вопрос «что произошло», а
 * «почему так вышло» видно только в самой заявке.
 *
 * Старые сотрудники остаются в журнале после блокировки и смены роли сами собой — имя
 * автора действия бэкенд сохраняет в самом событии, а не подтягивает из живого аккаунта.
 */
export function ServiceAuditTab() {
  const [filter, setFilter] = useState<AuditFilter>(EMPTY_AUDIT_FILTER);
  const [actor, setActor] = useState<PickedAccount | null>(null);
  const [page, setPage] = useState(0);
  // Снимок и заявка, которой он принадлежит: содержимое забирается по обоим
  // идентификаторам сразу (`/service-requests/{id}/photos/{photoId}/content`).
  const [zoomed, setZoomed] = useState<{ requestId: number; photo: ServiceRequestPhoto } | null>(
    null,
  );

  const auditQuery = useServiceAudit(filter, page);

  function patch(next: Partial<AuditFilter>) {
    setFilter((prev) => ({ ...prev, ...next }));
    setPage(0);
  }

  function reset() {
    setFilter(EMPTY_AUDIT_FILTER);
    setActor(null);
    setPage(0);
  }

  const rows = auditQuery.data?.content ?? [];
  const total = auditQuery.data?.totalElements ?? 0;
  const totalPages = auditQuery.data?.totalPages ?? 0;

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Действие">
            <Select
              value={filter.action ?? ''}
              onChange={(event) =>
                patch({ action: (event.target.value || null) as ServiceRequestAction | null })
              }
            >
              <option value="">Любое</option>
              {HISTORY_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {historyEventLabel(action)}
                </option>
              ))}
            </Select>
          </Field>

          <AccountPicker
            label="Пользователь"
            placeholder="ФИО пользователя"
            value={actor}
            onChange={(next) => {
              setActor(next);
              patch({ actorId: next?.id ?? null });
            }}
          />

          <Field label="События с">
            <TextInput
              type="date"
              value={filter.from}
              onChange={(event) => patch({ from: event.target.value })}
            />
          </Field>

          <div className="flex items-end gap-2">
            <Field label="по">
              <TextInput
                type="date"
                value={filter.to}
                min={filter.from || undefined}
                onChange={(event) => patch({ to: event.target.value })}
              />
            </Field>
            {hasActiveAuditFilters(filter) && (
              <Button
                variant="ghost"
                onClick={reset}
                icon={<X className="size-4" />}
                className="shrink-0"
              >
                Сбросить
              </Button>
            )}
          </div>
        </div>
      </section>

      {auditQuery.isPending ? (
        <div className="card space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className="block h-12 animate-pulse rounded-lg bg-neutral-bg" />
          ))}
        </div>
      ) : auditQuery.isError ? (
        <ErrorBlock
          message={actionErrorText(auditQuery.error)}
          onRetry={() => void auditQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyBlock
            title={hasActiveAuditFilters(filter) ? 'Событий не найдено' : 'Журнал пуст'}
            description={
              hasActiveAuditFilters(filter)
                ? 'Измените фильтры или очистите период.'
                : 'Здесь появятся все действия по сервисным заявкам школы.'
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse">
              <thead className="border-b border-line bg-neutral-bg/40">
                <tr>
                  <th scope="col" className={cx(HEAD_CELL, 'w-44')}>
                    Дата и время
                  </th>
                  <th scope="col" className={cx(HEAD_CELL, 'w-44')}>
                    Заявка
                  </th>
                  <th scope="col" className={cx(HEAD_CELL, 'w-52')}>
                    Пользователь
                  </th>
                  <th scope="col" className={cx(HEAD_CELL, 'w-56')}>
                    Действие
                  </th>
                  <th scope="col" className={HEAD_CELL}>
                    Изменения и причина
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <AuditRow
                    key={`${entry.requestId}-${entry.event?.id}`}
                    entry={entry}
                    onZoom={setZoomed}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <Pager
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={AUDIT_PAGE_SIZE}
            unit={['событие', 'события', 'событий']}
            onPage={setPage}
          />
        </div>
      )}

      {zoomed && (
        <ServicePhotoViewer
          requestId={zoomed.requestId}
          photo={zoomed.photo}
          onClose={() => setZoomed(null)}
        />
      )}
    </div>
  );
}

const HEAD_CELL = 'px-4 py-3 text-left text-10 font-medium uppercase tracking-wide text-subtle';
const CELL = 'px-4 py-4 align-top text-13 text-ink';

function AuditRow({
  entry,
  onZoom,
}: {
  entry: ServiceRequestAuditEntry;
  onZoom: (zoom: { requestId: number; photo: ServiceRequestPhoto }) => void;
}) {
  const event = entry.event;
  const requestId = entry.requestId as number;
  const changes = event ? stateChanges(event) : [];
  // У события создания `comment` — это описание заявки, а не причина действия: оно
  // целиком лежит в самой заявке, и повторять его строкой журнала незачем.
  const reason = event?.comment && event.action !== 'CREATED' ? event.comment : null;
  const photos = event?.photos ?? [];

  return (
    <tr className="border-b border-line last:border-0 align-top hover:bg-neutral-bg/30">
      <td className={cx(CELL, 'whitespace-nowrap text-subtle')}>
        {formatDateTime(event?.createdAt)}
      </td>

      <td className={CELL}>
        {/* §9: из события — в заявку. `?from=audit` вернёт обратно в журнал. */}
        <Link
          to={`${ROUTES.serviceRequest(requestId)}?from=audit`}
          className="font-semibold text-link hover:underline"
        >
          {entry.requestNumber}
        </Link>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <ServiceStatusChip status={entry.requestStatus} />
          <span className="text-11 text-subtle">{serviceTypeLabel(entry.serviceType)}</span>
        </span>
      </td>

      <td className={cx(CELL, 'truncate')}>{event?.actorName ?? '—'}</td>

      <td className={cx(CELL, 'font-medium')}>{historyEventLabel(event?.action)}</td>

      <td className={CELL}>
        {changes.length === 0 && !reason && photos.length === 0 ? (
          <span className="text-subtle">—</span>
        ) : (
          <div className="space-y-1.5">
            {changes.map((change) => (
              <p key={change.label} className="flex flex-wrap items-center gap-1.5 text-11">
                <span className="text-subtle">{change.label}:</span>
                <span className="text-ink">{change.from}</span>
                <ArrowRight className="size-3 text-subtle" aria-hidden />
                <span className="font-semibold text-ink">{change.to}</span>
              </p>
            ))}
            {reason && <p className="text-13 text-ink">{reason}</p>}
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {photos.map((photo) => (
                  <ServicePhotoThumb
                    key={photo.id}
                    requestId={requestId}
                    photo={photo}
                    size="sm"
                    onOpen={() => onZoom({ requestId, photo })}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
