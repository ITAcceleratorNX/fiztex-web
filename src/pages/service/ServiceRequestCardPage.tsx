import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Brush, ChevronRight, Trash2, Undo2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  useCancelServiceRequest,
  useMyAccountId,
  useServiceRequest,
  useServiceRequestHistory,
} from '@/hooks/queries';
import { cx, formatDateTime } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import type {
  ServiceRequest,
  ServiceRequestHistoryEntry,
  ServiceRequestPhoto,
} from '@/lib/serviceRequestsApi';
import {
  actionErrorText,
  canCancel,
  canReturnCompleted,
  historyEventLabel,
  locationLine,
  returnWindowLeft,
  serviceTypeLabel,
  viewerContext,
} from '@/lib/serviceRequestsModel';
import { ReopenServiceRequestModal } from './ReopenServiceRequestModal';
import { ServicePhotoThumb, ServicePhotoViewer } from './ServicePhoto';
import { EmergencyChip, ServiceStatusChip, ViewerContextChip } from './ServiceStatusChip';

/**
 * Детальная страница заявки глазами автора (ТЗ SERVICE-FE-001 §6–§9, Figma «Заявка
 * №1042 — Детали» и «Заявка №1050 — Удалить»).
 *
 * Одна страница на все четыре статуса, а не четыре: состав данных у них общий,
 * различаются только блоки, которых у заявки ещё не было, и действия — а их задаёт
 * статус.
 *
 * Страница ничего не решает за бэкенд. «Удалить» и «Вернуть в работу» она прячет по тем
 * же условиям, по которым сервер откажет, — но именно прячет, а не разрешает: результат
 * действия всегда берётся из ответа, включая новый статус и нового исполнителя (§8).
 *
 * Чего здесь нет и не будет (§10): «Редактировать» — в макете кнопка стоит справа от
 * «Удалить», но после создания поля заявки не меняются; поля «Написать комментарий»,
 * вложений через ленту и самих свободных комментариев — лента только хронология;
 * исполнительских действий («Передать другой службе», «Вернуть в очередь», «Выполнить»),
 * нарисованных на макете заявки в работе, — их у Admin и Teacher нет.
 */
export function ServiceRequestCardPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const id = Number(requestId);
  const valid = Number.isFinite(id);
  const navigate = useNavigate();
  const toast = useToast();

  const accountId = useMyAccountId();
  const cardQuery = useServiceRequest(valid ? id : null);
  const historyQuery = useServiceRequestHistory(valid ? id : null);
  const cancel = useCancelServiceRequest();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [zoomed, setZoomed] = useState<ServiceRequestPhoto | null>(null);

  const request = cardQuery.data;
  useDocumentTitle(request?.requestNumber ? `Заявка ${request.requestNumber}` : 'Заявка');

  if (cardQuery.isPending) return <LoadingBlock label="Загрузка заявки…" />;
  if (cardQuery.isError || !request) {
    return (
      <ErrorBlock
        message={actionErrorText(cardQuery.error)}
        onRetry={() => void cardQuery.refetch()}
      />
    );
  }

  const deletable = canCancel(request, accountId);
  const returnable = canReturnCompleted(request, accountId);
  const windowLeft = returnable ? returnWindowLeft(request) : null;

  // §6: «Фото» — снимки создания, а не все снимки заявки. Фотографии результата приложил
  // исполнитель, и их место в ленте под событием «Заявка выполнена», иначе они выглядели
  // бы как то, что снял сам автор. Если лента не догрузилась, показываем плоский список:
  // лучше все, чем ни одной.
  const created = historyQuery.data?.find((event) => event.action === 'CREATED');
  const photos = created ? (created.photos ?? []) : (request.photos ?? []);

  async function onDelete() {
    try {
      await cancel.mutateAsync(id);
      setConfirmDelete(false);
      toast.success('Заявка отменена и перенесена в историю');
      // §7: заявка исчезает из активных и появляется в «Истории». Возврат в список, а не
      // показ той же карточки с новым статусом: человек нажал «удалить», и остаться на
      // ней значило бы ответить не на то, что он просил.
      navigate(ROUTES.serviceRequests);
    } catch (error) {
      toast.error(actionErrorText(error));
    }
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Хлебные крошки" className="flex items-center gap-1.5 text-13 text-subtle">
        <Link to={ROUTES.serviceRequests} className="transition hover:text-ink">
          Сервисные заявки
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-semibold text-link">Заявка</span>
      </nav>

      <header className="space-y-3">
        <h1 className="text-28 font-bold text-ink">Заявка {request.requestNumber}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <ServiceStatusChip status={request.status} />
          <ServiceTypeChip request={request} />
          <span className="text-13 text-ink">{locationLine(request)}</span>
          {request.emergency && <EmergencyChip />}
          <ViewerContextChip label={viewerContext(request, accountId)} />
        </div>
      </header>

      <section className="card space-y-5 p-6">
        <div>
          <h2 className="label-base">Описание</h2>
          <p className="whitespace-pre-wrap text-13 leading-relaxed text-ink">
            {request.description}
          </p>
        </div>

        {photos.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="label-base">Фото</h2>
              <span className="text-11 text-subtle">Нажмите для увеличения</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-3">
              {photos.map((photo) => (
                <ServicePhotoThumb
                  key={photo.id}
                  requestId={id}
                  photo={photo}
                  size="md"
                  onOpen={() => setZoomed(photo)}
                />
              ))}
            </div>
          </div>
        )}

        {/* §6: блоков ровно столько, сколько с заявкой уже произошло. У новой заявки
            колонки исполнителя нет вовсе — «Исполнитель: —» сообщал бы о ней то, чего
            не было. */}
        <div className="grid gap-6 border-t border-line pt-5 sm:grid-cols-2">
          <div className="space-y-4">
            <MetaBlock label="Автор" value={request.authorName} />
            <MetaBlock label="Дата создания" value={formatDateTime(request.createdAt)} />
          </div>
          <div className="space-y-4">
            <MetaBlock label="Исполнитель" value={request.assignedToName} />
            <MetaBlock label="Взято в работу" value={dateOrNull(request.claimedAt)} />
            <MetaBlock label="Выполнена" value={dateOrNull(request.completedAt)} />
            <MetaBlock label="Отменена" value={dateOrNull(request.cancelledAt)} />
          </div>
        </div>
      </section>

      {/* §7: действия задаёт статус. У «В работе» и «Отменена» их нет — только просмотр,
          и строка действий тогда не рисуется вовсе. */}
      {(deletable || returnable) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {deletable ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-1.5 size-4" aria-hidden />
              Удалить заявку
            </Button>
          ) : (
            <span />
          )}

          {returnable && (
            <div className="text-right">
              <Button onClick={() => setReopenOpen(true)}>
                <Undo2 className="mr-1.5 size-4" aria-hidden />
                Вернуть в работу
              </Button>
              {/* §7: после 48 часов кнопки нет вовсе, поэтому подпись говорит только о
                  том, сколько времени ещё осталось. */}
              {windowLeft && <p className="mt-1 text-11 text-subtle">{windowLeft} на возврат</p>}
            </div>
          )}
        </div>
      )}

      <HistoryFeed
        requestId={id}
        entries={historyQuery.data ?? []}
        loading={historyQuery.isPending}
        failed={historyQuery.isError}
        onZoom={setZoomed}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void onDelete()}
        title={`Удалить заявку ${request.requestNumber ?? ''}?`.replace(' ?', '?')}
        message="Заявка будет перемещена в историю со статусом «Отменена». Это действие нельзя отменить."
        confirmLabel="Удалить"
        danger
        loading={cancel.isPending}
      />

      <ReopenServiceRequestModal
        open={reopenOpen}
        requestId={id}
        onClose={() => setReopenOpen(false)}
        onDone={() => {
          setReopenOpen(false);
          toast.success('Заявка возвращена в работу');
        }}
      />

      {zoomed && (
        <ServicePhotoViewer requestId={id} photo={zoomed} onClose={() => setZoomed(null)} />
      )}
    </div>
  );
}

/**
 * Лента событий (§9) — хронология, а не переписка.
 *
 * Свежие сверху: страница открывается ради того, что с заявкой происходит сейчас, и
 * искать последнее событие внизу длинного списка пришлось бы каждый раз. Бэкенд отдаёт
 * ленту в прямом порядке, поэтому разворот делается здесь.
 */
function HistoryFeed({
  requestId,
  entries,
  loading,
  failed,
  onZoom,
}: {
  requestId: number;
  entries: ServiceRequestHistoryEntry[];
  loading: boolean;
  failed: boolean;
  onZoom: (photo: ServiceRequestPhoto) => void;
}) {
  const newestFirst = [...entries].reverse();

  return (
    <section className="space-y-4">
      <h2 className="text-15 font-bold text-ink">Лента</h2>

      {loading ? (
        <p className="text-13 text-subtle">Загрузка истории…</p>
      ) : failed ? (
        // Недоступная хронология не прячет саму заявку: она вспомогательная.
        <p className="text-13 text-subtle">Не удалось загрузить историю событий.</p>
      ) : newestFirst.length === 0 ? (
        <p className="text-13 text-subtle">Событий пока нет.</p>
      ) : (
        <ol className="space-y-4">
          {newestFirst.map((event, index) => (
            <li key={event.id} className="flex gap-3">
              <span
                className={cx(
                  'mt-1 size-4 shrink-0 rounded-full border-2',
                  index === 0 ? 'border-brand-500' : 'border-slate-300',
                )}
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="text-13 font-semibold text-ink">
                    {historyEventLabel(event.action)}
                  </span>
                  <span className="text-11 text-subtle">{formatDateTime(event.createdAt)}</span>
                </p>
                {event.actorName && <p className="text-11 text-subtle">{event.actorName}</p>}
                {event.assigneeAfterName && (
                  <p className="text-13 text-ink">Исполнитель: {event.assigneeAfterName}</p>
                )}
                {/* У события создания `comment` — это описание заявки, оно уже стоит
                    выше отдельным блоком; повторять его значило бы сказать дважды. */}
                {event.comment && event.action !== 'CREATED' && (
                  <p className="text-13 text-ink">{event.comment}</p>
                )}

                {event.photos && event.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {event.photos.map((photo) => (
                      <ServicePhotoThumb
                        key={photo.id}
                        requestId={requestId}
                        photo={photo}
                        size="md"
                        onOpen={() => onZoom(photo)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Тип заявки чипом с глифом — как в шапке макета, рядом со статусом. */
function ServiceTypeChip({ request }: { request: ServiceRequest }) {
  const Icon = request.serviceType === 'CLEANING' ? Brush : Wrench;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-bg px-2.5 py-1 text-11 font-medium text-ink">
      <Icon className="size-3.5" aria-hidden />
      {serviceTypeLabel(request.serviceType)}
    </span>
  );
}

function MetaBlock({ label, value }: { label: string; value: string | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <p className="text-11 text-subtle">{label}</p>
      <p className="text-13 font-semibold text-ink">{value}</p>
    </div>
  );
}

function dateOrNull(iso: string | undefined): string | undefined {
  return iso ? formatDateTime(iso) : undefined;
}
