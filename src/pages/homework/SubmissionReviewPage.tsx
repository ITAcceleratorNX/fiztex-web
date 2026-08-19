import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronDown, X } from 'lucide-react';
import { Button, buttonClassName } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api';
import { cx, formatDateTime } from '@/lib/format';
import { homeworkApi, type Attempt, type ReviewDecision } from '@/lib/homeworkApi';
import { AttachmentChip, AttachmentThumb } from './AttachmentLink';
import { SUBMISSION_STATUS_LABELS, SUBMISSION_STATUS_TONES } from './homeworkModel';

/** §9.3: комментарий и фотографии ограничены бэкендом, дублировать числа больше негде. */
const COMMENT_LIMIT = 2000;
const PHOTO_LIMIT = 5;

/**
 * Проверка работы ученика (ТЗ FE-Teacher-002 §8–9, Figma 864:165, 865:165).
 *
 * Решение всегда относится к конкретной версии: в запрос уходит `expectedAttemptId`, и если
 * ученик успел прислать новую, бэкенд отвечает 409. Это не сбой, а именно то, ради чего
 * поле существует, — поэтому 409 показывается отдельным понятным текстом, а экран
 * перезагружает работу, чтобы учитель решал уже по актуальной версии.
 *
 * Поля оценки здесь нет намеренно: в макете оно есть, но по ТЗ §11 связка Homework с
 * журналом делается отдельной задачей, и подключать поле раньше API нельзя.
 */
export function SubmissionReviewPage() {
  const { homeworkId, studentProfileId } = useParams<{ homeworkId: string; studentProfileId: string }>();
  const id = Number(homeworkId);
  const studentId = Number(studentProfileId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [confirm, setConfirm] = useState<ReviewDecision | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const submissionQuery = useQuery({
    queryKey: ['homework', 'submission', id, studentId],
    queryFn: ({ signal }) => homeworkApi.submission(id, studentId, signal),
    enabled: Number.isFinite(id) && Number.isFinite(studentId),
  });
  const submission = submissionQuery.data;

  useDocumentTitle(submission?.studentFullName ?? 'Работа ученика');

  // Ростер нужен только ради соседей для «Пред./След.» (§9.4) — он уже в кэше карточки.
  const rosterQuery = useQuery({
    queryKey: ['homework', 'roster', id],
    queryFn: ({ signal }) => homeworkApi.roster(id, signal),
  });

  const neighbours = useMemo(() => {
    const list = (rosterQuery.data?.students ?? []).filter((s) => s.status !== 'NOT_SUBMITTED');
    const index = list.findIndex((s) => s.studentProfileId === studentId);
    if (index < 0) return { prev: undefined, next: undefined };
    return { prev: list[index - 1], next: list[index + 1] };
  }, [rosterQuery.data, studentId]);

  // Новая работа — чистая форма: чужой комментарий не должен уехать другому ученику.
  useEffect(() => {
    setComment('');
    setPhotos([]);
  }, [id, studentId]);

  const loadAttachment = useCallback(
    (attachmentId: number) => homeworkApi.submissionAttachmentBlob(id, studentId, attachmentId),
    [id, studentId],
  );
  const loadReviewPhoto = useCallback(
    (photoId: number) => homeworkApi.reviewPhotoBlob(id, studentId, photoId),
    [id, studentId],
  );

  const review = useMutation({
    mutationFn: (decision: ReviewDecision) => {
      const attemptId = submission?.currentAttempt?.id;
      if (attemptId == null) throw new ApiError(0, 'У работы нет текущей версии');
      return homeworkApi.review(id, studentId, {
        decision,
        expectedAttemptId: attemptId,
        comment: comment.trim() || undefined,
        photos,
      });
    },
    onSuccess: (_data, decision) => {
      setConfirm(null);
      setComment('');
      setPhotos([]);
      void queryClient.invalidateQueries({ queryKey: ['homework'] });
      toast.success(decision === 'DONE' ? 'Работа принята' : 'Работа возвращена ученику');
    },
    onError: (error) => {
      setConfirm(null);
      if (error instanceof ApiError && error.status === 409) {
        toast.error('Ученик прислал новую версию — работа обновлена, посмотрите её заново');
        void submissionQuery.refetch();
        return;
      }
      toast.error(error instanceof ApiError ? error.message : 'Не удалось сохранить решение');
    },
  });

  if (submissionQuery.isPending) return <LoadingBlock label="Загрузка работы…" />;

  if (submissionQuery.error instanceof ApiError && [403, 404].includes(submissionQuery.error.status)) {
    return (
      <div className="card">
        <EmptyBlock
          title="Работа недоступна"
          description="Задание отменено, удалено или относится к другому учителю."
          action={
            <Link to={`/homework/${id}`} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
              К заданию
            </Link>
          }
        />
      </div>
    );
  }
  if (submissionQuery.isError || !submission) {
    return (
      <div className="card">
        <ErrorBlock message="Не удалось загрузить работу" onRetry={() => void submissionQuery.refetch()} />
      </div>
    );
  }

  const status = submission.status ?? 'NOT_SUBMITTED';
  const current = submission.currentAttempt;
  const history = (submission.history ?? []).filter((a) => a.id !== current?.id);
  // Решение принимается только по работе, ждущей проверки (§9).
  const canDecide = status === 'SUBMITTED' && current?.id != null;
  const busy = review.isPending;

  function addPhotos(files: FileList | null) {
    if (!files) return;
    setPhotos((prev) => [...prev, ...Array.from(files)].slice(0, PHOTO_LIMIT));
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={`/homework/${id}`} aria-label="К заданию" className="text-subtle transition hover:text-ink">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="truncate text-xl font-bold text-ink">
            <span className="text-muted">Ответ: </span>
            {submission.studentFullName}
          </h1>
          <span className={cx('inline-flex items-center rounded px-2 py-0.5 text-11 font-medium', SUBMISSION_STATUS_TONES[status])}>
            {status === 'SUBMITTED' ? 'На проверке' : SUBMISSION_STATUS_LABELS[status]}
          </span>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!neighbours.prev}
            onClick={() => navigate(`/homework/${id}/students/${neighbours.prev?.studentProfileId}`)}
          >
            <ArrowLeft className="size-4" aria-hidden /> Пред.
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!neighbours.next}
            onClick={() => navigate(`/homework/${id}/students/${neighbours.next?.studentProfileId}`)}
          >
            След. <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {current ? (
        <AttemptCard
          attempt={current}
          totalVersions={submission.attemptCount ?? 1}
          loadAttachment={loadAttachment}
          loadReviewPhoto={loadReviewPhoto}
          current
        />
      ) : (
        <div className="card">
          <EmptyBlock title="Ученик ещё не отправил работу" />
        </div>
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-13 font-medium text-subtle">История версий</h2>
          {history.map((attempt) => (
            <HistoryRow
              key={attempt.id}
              attempt={attempt}
              loadAttachment={loadAttachment}
              loadReviewPhoto={loadReviewPhoto}
            />
          ))}
        </section>
      )}

      {canDecide && (
        <section className="card flex flex-col gap-4 p-5">
          <h2 className="text-base font-semibold text-ink">Обратная связь</h2>

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="review-comment" className="label-base">
                Комментарий (необязательно)
              </label>
              <textarea
                id="review-comment"
                value={comment}
                maxLength={COMMENT_LIMIT}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Напишите комментарий ученику…"
                rows={4}
                className="input-base mt-1.5 resize-y"
              />
              <p className="mt-1 text-11 text-subtle">
                {comment.length} / {COMMENT_LIMIT}
              </p>
            </div>

            <div>
              <p className="label-base">Фото (необязательно)</p>
              <div className="mt-1.5 flex flex-wrap items-start gap-2">
                {photos.map((photo, index) => (
                  <PendingPhoto
                    key={`${photo.name}-${index}`}
                    file={photo}
                    onRemove={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                  />
                ))}
                {photos.length < PHOTO_LIMIT && (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="flex size-20 items-center justify-center rounded-lg border border-dashed border-line text-xl text-subtle transition hover:border-navy-400 hover:text-ink"
                    aria-label="Прикрепить фото"
                  >
                    +
                  </button>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => addPhotos(event.target.files)}
              />
              <p className="mt-1 text-11 text-subtle">
                Прикрепить фото · {photos.length} из {PHOTO_LIMIT}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm('RETURNED')} disabled={busy}>
              Вернуть
            </Button>
            <Button onClick={() => setConfirm('DONE')} disabled={busy}>
              Выполнено
            </Button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirm === 'RETURNED'}
        onClose={() => setConfirm(null)}
        onConfirm={() => review.mutate('RETURNED')}
        loading={busy}
        title="Вернуть работу на доработку?"
        confirmLabel="Вернуть"
        message="Ученик сможет исправить работу и прислать новую версию. Текущая версия останется в истории."
      />
      <ConfirmDialog
        open={confirm === 'DONE'}
        onClose={() => setConfirm(null)}
        onConfirm={() => review.mutate('DONE')}
        loading={busy}
        title="Принять работу?"
        confirmLabel="Выполнено"
        message="После принятия ученик больше не сможет редактировать эту отправку."
      />
    </div>
  );
}

function AttemptCard({
  attempt,
  totalVersions,
  loadAttachment,
  loadReviewPhoto,
  current = false,
}: {
  attempt: Attempt;
  totalVersions?: number;
  loadAttachment: (id: number) => Promise<Blob>;
  loadReviewPhoto: (id: number) => Promise<Blob>;
  current?: boolean;
}) {
  return (
    <section className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Ответ ученика</h2>
        <div className="flex items-center gap-2">
          {attempt.attemptNumber != null && (
            <span className="rounded bg-info-bg px-2 py-0.5 text-11 font-medium text-link">
              Версия {attempt.attemptNumber}
              {current && totalVersions ? ' (текущая)' : ''}
            </span>
          )}
          {attempt.submittedAt && (
            <span className="rounded bg-neutral-bg px-2 py-0.5 text-11 text-neutral-fg">
              Отправлено: {formatDateTime(attempt.submittedAt)}
            </span>
          )}
        </div>
      </div>

      {attempt.body ? (
        <p className="whitespace-pre-wrap rounded-xl bg-neutral-bg/50 p-3 text-sm text-ink">{attempt.body}</p>
      ) : (
        <p className="text-13 text-subtle">Без текста</p>
      )}

      {(attempt.files?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-13 text-subtle">Файлы:</span>
          {attempt.files?.map((file) => (
            <AttachmentChip key={file.id} attachment={file} load={loadAttachment} />
          ))}
        </div>
      )}

      {(attempt.photos?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {attempt.photos?.map((photo) => (
            <AttachmentThumb key={photo.id} attachment={photo} load={loadAttachment} />
          ))}
        </div>
      )}

      {(attempt.reviews?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          {attempt.reviews?.map((decision) => (
            <div key={decision.id} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-13">
                <span
                  className={cx(
                    'inline-flex items-center rounded px-2 py-0.5 text-11 font-medium',
                    decision.decision === 'DONE' ? 'bg-success-bg text-success-fg' : 'bg-attention-bg text-attention-fg',
                  )}
                >
                  {decision.decision === 'DONE' ? 'Выполнено' : 'Возвращено'}
                </span>
                {decision.createdAt && <span className="text-subtle">{formatDateTime(decision.createdAt)}</span>}
              </div>
              {decision.comment && <p className="whitespace-pre-wrap text-13 text-muted">{decision.comment}</p>}
              {(decision.photos?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2">
                  {decision.photos?.map((photo) => (
                    <AttachmentThumb key={photo.id} attachment={photo} load={loadReviewPhoto} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Прошлая версия — только просмотр (§8): ни правки, ни нового решения по ней. */
function HistoryRow({
  attempt,
  loadAttachment,
  loadReviewPhoto,
}: {
  attempt: Attempt;
  loadAttachment: (id: number) => Promise<Blob>;
  loadReviewPhoto: (id: number) => Promise<Blob>;
}) {
  const [open, setOpen] = useState(false);
  const decision = attempt.reviews?.at(-1)?.decision;

  return (
    <div className="card overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <span className="flex items-center gap-3 text-sm">
          <span className="font-medium text-ink">Версия {attempt.attemptNumber}</span>
          {attempt.submittedAt && <span className="text-subtle">{formatDateTime(attempt.submittedAt)}</span>}
        </span>
        <span className="flex items-center gap-2">
          {decision && (
            <span
              className={cx(
                'inline-flex items-center rounded px-2 py-0.5 text-11 font-medium',
                decision === 'DONE' ? 'bg-success-bg text-success-fg' : 'bg-attention-bg text-attention-fg',
              )}
            >
              {decision === 'DONE' ? 'Выполнено' : 'Возвращено'}
            </span>
          )}
          <ChevronDown className={cx('size-4 text-subtle transition', open && 'rotate-180')} aria-hidden />
        </span>
      </button>

      {open && (
        <div className="border-t border-line px-5 py-3">
          <AttemptCard attempt={attempt} loadAttachment={loadAttachment} loadReviewPhoto={loadReviewPhoto} />
        </div>
      )}
    </div>
  );
}

/** Ещё не отправленное фото: предпросмотр из локального файла и удаление до отправки (§9.3). */
function PendingPhoto({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <span className="relative block size-20 overflow-hidden rounded-lg bg-neutral-bg">
      {url && <img src={url} alt={file.name} className="size-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Убрать фото ${file.name}`}
        className="absolute right-1 top-1 rounded-full bg-ink/70 p-0.5 text-white transition hover:bg-ink"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
