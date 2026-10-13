import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock, MessageSquare, Pencil, Users, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import { audienceLabel, longDate, timeRange } from '@/lib/oneTimeEventModel';
import { ONE_TIME_EVENTS_KEY, oneTimeEventsApi, type OneTimeEvent } from '@/lib/oneTimeEventsApi';

/**
 * Карточка разового события: что, когда, кому и что оно затрагивает — всё посчитано сервером.
 * Отсюда же правка и отмена. Отмена уроки не восстанавливает: сетку событие не меняло, и после
 * отмены сетка просто перечитывается.
 */
export function OneTimeEventViewModal({
  eventId,
  onClose,
  onEdit,
}: {
  eventId: number | null;
  onClose: () => void;
  onEdit: (event: OneTimeEvent) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const detail = useQuery({
    queryKey: [...ONE_TIME_EVENTS_KEY, 'detail', eventId],
    queryFn: ({ signal }) => oneTimeEventsApi.get(eventId!, signal),
    enabled: eventId != null,
  });

  const cancel = useMutation({
    mutationFn: () => oneTimeEventsApi.cancel(eventId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ONE_TIME_EVENTS_KEY });
      setConfirmOpen(false);
      toast.success('Событие отменено');
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Не удалось отменить событие');
    },
  });

  const event = detail.data;
  const active = event?.status === 'ACTIVE';

  return (
    <>
      <Modal
        open={eventId != null && !confirmOpen}
        onClose={onClose}
        title={event?.title ?? 'Разовое событие'}
        subtitle={event && !active ? 'Событие отменено' : undefined}
        size="md"
        footer={event && active ? (
          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              type="button"
              icon={<XCircle className="size-4" />}
              className="text-red-600 hover:bg-red-50"
              onClick={() => setConfirmOpen(true)}
            >
              Отменить событие
            </Button>
            <Button type="button" variant="navy" icon={<Pencil className="size-4" />} onClick={() => onEdit(event)}>
              Изменить
            </Button>
          </div>
        ) : undefined}
      >
        {detail.isLoading && <LoadingBlock label="Загружаем событие..." />}
        {detail.isError && (
          <ErrorBlock
            message={detail.error instanceof ApiError ? detail.error.message : 'Не удалось загрузить событие'}
            onRetry={() => void detail.refetch()}
          />
        )}
        {event && (
          <div className="flex flex-col gap-4">
            <dl className="grid gap-3 text-13">
              <Row icon={<CalendarDays className="size-4" />} label="Дата">
                <span className="first-letter:uppercase">{event.date ? longDate(event.date) : '—'}</span>
              </Row>
              <Row icon={<Clock className="size-4" />} label="Время">{timeRange(event)}</Row>
              <Row icon={<Users className="size-4" />} label="Аудитория">{audienceLabel(event)}</Row>
              {event.comment && (
                <Row icon={<MessageSquare className="size-4" />} label="Комментарий">
                  <span className="whitespace-pre-line">{event.comment}</span>
                </Row>
              )}
            </dl>

            {event.impact && (
              <section className="rounded-lg border border-line p-3">
                <h3 className="text-13 font-semibold text-ink">Кого касается</h3>
                <p className="mt-1 text-13 text-muted">
                  Классов: {(event.impact.classes ?? []).length} · учеников: {event.impact.studentCount} ·
                  родителей: {event.impact.parentCount} · учителей: {(event.impact.teachers ?? []).length}
                </p>
                {(event.impact.lessons ?? []).length > 0 ? (
                  <ul className="mt-3 flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                    {(event.impact.lessons ?? []).map((lesson) => (
                      <li
                        key={`${lesson.lessonId}-${lesson.classId}`}
                        className="flex items-center justify-between gap-3 text-13"
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium text-ink">{timeRange(lesson)}</span>
                          {' · '}
                          {lesson.className}
                          {lesson.subgroupName ? ` (${lesson.subgroupName})` : ''}
                          {' · '}
                          {lesson.subjectName}
                          <span className="text-muted"> · {lesson.teacherFullName}</span>
                        </span>
                        <span
                          className={cx(
                            'shrink-0 rounded px-1.5 py-0.5 text-11 font-semibold',
                            lesson.coverage === 'FULL'
                              ? 'bg-violet-100 text-violet-700'
                              : 'bg-violet-50 text-violet-600',
                          )}
                        >
                          {lesson.coverage === 'FULL'
                            ? 'вместо урока'
                            : `частично, ${timeRange({ startTime: lesson.overlapStart, endTime: lesson.overlapEnd })}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-13 text-muted">Уроков в это время нет — событие всё равно видно аудитории.</p>
                )}
              </section>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => cancel.mutate()}
        loading={cancel.isPending}
        danger
        title="Отменить событие?"
        message="Событие исчезнет из расписания всех, кого оно касалось, и им придёт уведомление об отмене. Уроки останутся как были."
        confirmLabel="Отменить событие"
        cancelLabel="Не отменять"
      />
    </>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0">
        <dt className="text-11 font-semibold uppercase text-gray-400">{label}</dt>
        <dd className="text-ink">{children}</dd>
      </div>
    </div>
  );
}
