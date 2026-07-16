import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  X,
  ShieldAlert,
  CircleDot,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { keys } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TextArea } from '@/components/ui/Field';
import { Spinner, ErrorBlock } from '@/components/ui/StateBlock';
import { cx, formatDateTime } from '@/lib/format';
import type { AnswerReviewItem, QuestionType, ReviewDetail, ReviewPhoto } from '@/lib/types';

const TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Один вариант',
  MULTIPLE_CHOICE: 'Несколько вариантов',
  OPEN_TEXT: 'Открытый ответ',
  PHOTO: 'Фото',
};

const EVENT_LABEL: Record<string, string> = {
  STARTED: 'Старт теста',
  FOCUS_LOST: 'Ушёл со вкладки / потерял фокус',
  FOCUS_RETURNED: 'Вернулся в окно',
  PAGE_CLOSED: 'Закрыл / обновил страницу',
  RESUMED: 'Повторный вход',
  TIME_EXPIRED: 'Истекло время',
  SUBMITTED: 'Отправлено на проверку',
  TAB_SWITCH: 'Переключение вкладки',
  WINDOW_BLUR: 'Потеря фокуса окна',
  PAGE_CLOSE: 'Закрытие страницы',
  RE_ENTRY: 'Повторный вход',
};

interface Draft {
  score: string;
  comment: string;
}

export function ReviewModal({
  open,
  attemptId,
  onClose,
}: {
  open: boolean;
  attemptId: number | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();

  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [schoolComment, setSchoolComment] = useState('');
  const [internalComment, setInternalComment] = useState('');
  const [savingQ, setSavingQ] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [opening, setOpening] = useState(false);
  const activeAttemptRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      activeAttemptRef.current = null;
      setDetail(null);
      setLoadError(null);
      setLoading(false);
      setDrafts({});
      setSchoolComment('');
      setInternalComment('');
      setSavingQ(null);
      setConfirming(false);
      setOpening(false);
      return;
    }

    if (attemptId == null) return;
    activeAttemptRef.current = attemptId;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setDetail(null);
    setDrafts({});
    setSchoolComment('');
    setInternalComment('');
    api
      .getReview(attemptId)
      .then((d) => {
        if (cancelled || activeAttemptRef.current !== attemptId) return;
        applyDetail(d);
      })
      .catch((e) => {
        if (cancelled || activeAttemptRef.current !== attemptId) return;
        setLoadError(e instanceof ApiError ? e.message : 'Не удалось загрузить попытку');
      })
      .finally(() => {
        if (!cancelled && activeAttemptRef.current === attemptId) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attemptId]);

  function applyDetail(d: ReviewDetail) {
    setDetail(d);
    setSchoolComment(d.schoolComment ?? '');
    setInternalComment(d.internalComment ?? '');
    setDrafts((prev) => {
      const next = { ...prev };
      for (const a of d.answers) {
        // Keep the admin's in-progress edits; only seed rows we have not touched yet.
        if (next[a.questionId] === undefined) {
          next[a.questionId] = {
            score: String(a.finalScore ?? a.autoScore ?? 0),
            comment: a.adminComment ?? '',
          };
        }
      }
      return next;
    });
  }

  const locked = detail != null && detail.status !== 'PENDING';
  const maxTotal = (detail?.answers ?? []).reduce((s, a) => s + a.maxScore, 0);

  async function saveAnswer(a: AnswerReviewItem) {
    if (attemptId == null || activeAttemptRef.current !== attemptId) return;
    const draft = drafts[a.questionId];
    const score = Number(draft?.score ?? 0);
    if (Number.isNaN(score) || score < 0 || score > a.maxScore) {
      toast.error(`Балл должен быть от 0 до ${a.maxScore}`);
      return;
    }
    setSavingQ(a.questionId);
    try {
      const updated = await api.scoreAnswer(attemptId, a.questionId, {
        finalScore: score,
        adminComment: draft?.comment || null,
      });
      if (activeAttemptRef.current !== attemptId) return;
      setDetail(updated);
      toast.success('Балл сохранён');
    } catch (e) {
      if (activeAttemptRef.current !== attemptId) return;
      toast.error(e instanceof ApiError ? e.message : 'Не удалось сохранить балл');
    } finally {
      if (activeAttemptRef.current === attemptId) setSavingQ(null);
    }
  }

  async function confirm() {
    if (attemptId == null || activeAttemptRef.current !== attemptId) return;
    setConfirming(true);
    try {
      const updated = await api.confirmReview(attemptId, {
        schoolComment: schoolComment || null,
        internalComment: internalComment || null,
      });
      if (activeAttemptRef.current !== attemptId) return;
      setDetail(updated);
      qc.invalidateQueries({ queryKey: keys.reviews });
      toast.success('Проверка подтверждена');
    } catch (e) {
      if (activeAttemptRef.current !== attemptId) return;
      toast.error(e instanceof ApiError ? e.message : 'Не удалось подтвердить проверку');
    } finally {
      if (activeAttemptRef.current === attemptId) setConfirming(false);
    }
  }

  async function openForViewing() {
    if (attemptId == null || activeAttemptRef.current !== attemptId) return;
    setOpening(true);
    try {
      const updated = await api.openResult(attemptId);
      if (activeAttemptRef.current !== attemptId) return;
      setDetail(updated);
      qc.invalidateQueries({ queryKey: keys.reviews });
      toast.success('Результат открыт для просмотра');
    } catch (e) {
      if (activeAttemptRef.current !== attemptId) return;
      toast.error(e instanceof ApiError ? e.message : 'Не удалось открыть результат');
    } finally {
      if (activeAttemptRef.current === attemptId) setOpening(false);
    }
  }

  function handleClose() {
    onClose();
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={handleClose} disabled={confirming || opening}>
        Закрыть
      </Button>
      {detail?.status === 'PENDING' && (
        <Button loading={confirming} disabled={loading || !detail} onClick={confirm}>
          Подтвердить проверку
        </Button>
      )}
      {detail?.status === 'REVIEWED' && (
        <Button loading={opening} disabled={loading || !detail} onClick={openForViewing}>
          Открыть результат по коду
        </Button>
      )}
    </>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title={detail ? `Проверка · ${detail.applicantName}` : 'Проверка ответов'}
      subtitle={detail ? `${detail.testTitle} · завершён ${formatDateTime(detail.finishedAt)}` : undefined}
      footer={footer}
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      ) : loadError ? (
        <ErrorBlock message={loadError} />
      ) : detail ? (
        <div className="space-y-5">
          {/* Status + score summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
            <div className="flex items-center gap-2">
              {detail.status === 'PENDING' ? (
                <Badge tone="amber" dot>Ожидает проверки</Badge>
              ) : detail.status === 'REVIEWED' ? (
                <Badge tone="blue" dot>Проверено</Badge>
              ) : (
                <Badge tone="green" dot>Результат открыт</Badge>
              )}
            </div>
            <div className="text-sm text-slate-600">
              Баллы:{' '}
              <span className="font-bold text-slate-900">
                {detail.totalScore} / {maxTotal}
              </span>
              <span className="ml-2 text-slate-400">мин. балл {detail.minScore}</span>
            </div>
          </div>

          {/* Anti-cheat logs */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-slate-700">
                Античит-события ({detail.suspiciousLogs.length})
              </span>
              {(detail.tabSwitchCount ?? 0) > 0 && (
                <Badge tone="amber" dot>
                  {detail.tabSwitchCount}{' '}
                  {detail.tabSwitchCount === 1
                    ? 'переключение вкладки'
                    : detail.tabSwitchCount < 5
                      ? 'переключения вкладки'
                      : 'переключений вкладки'}
                </Badge>
              )}
            </div>
            {detail.suspiciousLogs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Событий не зафиксировано.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {detail.suspiciousLogs.map((log, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <CircleDot className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                    <span className="font-medium text-slate-700">
                      {EVENT_LABEL[log.type] ?? log.type}
                    </span>
                    <span className="text-slate-400">· {formatDateTime(log.occurredAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-400">
              События информационные. Автопровала нет — итоговое решение принимает школа.
            </p>
          </div>

          {/* Answers */}
          <div className="space-y-4">
            {detail.answers.map((a, idx) => (
              <AnswerCard
                key={a.questionId}
                index={idx + 1}
                answer={a}
                draft={drafts[a.questionId] ?? { score: '0', comment: '' }}
                locked={locked}
                saving={savingQ === a.questionId}
                onChange={(d) => setDrafts((p) => ({ ...p, [a.questionId]: d }))}
                onSave={() => saveAnswer(a)}
              />
            ))}
          </div>

          {/* School comment — visible to the applicant/parent after the result is opened */}
          <div>
            <label className="label-base">Комментарий школы (виден поступающему)</label>
            <TextArea
              value={schoolComment}
              onChange={(e) => setSchoolComment(e.target.value)}
              placeholder="Комментарий, который увидит поступающий после открытия результата…"
              disabled={locked}
              rows={3}
            />
          </div>

          {/* Internal comment — never shown to the applicant */}
          <div>
            <label className="label-base">Внутренний комментарий (только для школы)</label>
            <TextArea
              value={internalComment}
              onChange={(e) => setInternalComment(e.target.value)}
              placeholder="Заметка для школы/админа — поступающий её не увидит…"
              disabled={locked}
              rows={3}
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function ReviewPhotoGallery({ photos }: { photos: ReviewPhoto[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const open = openIdx !== null;
  const photo = openIdx !== null ? photos[openIdx] : null;

  const close = useCallback(() => {
    setOpenIdx(null);
    setZoom(1);
  }, []);

  const adjustZoom = useCallback((delta: number) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2))));
  }, []);

  const goPrev = useCallback(() => {
    setOpenIdx((idx) => (idx != null && idx > 0 ? idx - 1 : idx));
    setZoom(1);
  }, []);

  const goNext = useCallback(() => {
    setOpenIdx((idx) => (idx != null && idx < photos.length - 1 ? idx + 1 : idx));
    setZoom(1);
  }, [photos.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === '+' || e.key === '=') adjustZoom(ZOOM_STEP);
      else if (e.key === '-') adjustZoom(-ZOOM_STEP);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close, goPrev, goNext, adjustZoom]);

  function handleWheel(e: { preventDefault: () => void; deltaY: number }) {
    e.preventDefault();
    adjustZoom(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((item, photoIdx) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setOpenIdx(photoIdx);
              setZoom(1);
            }}
            className="group relative block overflow-hidden rounded-lg ring-1 ring-slate-200 transition hover:ring-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <img
              src={item.url}
              alt={`Фото ${photoIdx + 1}`}
              className="h-28 w-28 object-cover transition group-hover:opacity-90"
              loading="lazy"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition group-hover:bg-slate-900/20">
              <ZoomIn className="h-5 w-5 text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
            </span>
          </button>
        ))}
      </div>

      {open && photo && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-slate-950/90 backdrop-blur-sm animate-fade-in"
          onClick={close}
        >
          <div
            className="flex shrink-0 items-center justify-between gap-3 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-white/90">
              Фото {openIdx! + 1} из {photos.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => adjustZoom(-ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                aria-label="Уменьшить"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <span className="min-w-[3.5rem] text-center text-sm tabular-nums text-white/90">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => adjustZoom(ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM}
                className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                aria-label="Увеличить"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={close}
                className="ml-2 rounded-lg p-2 text-white/80 transition hover:bg-white/10"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto px-4 pb-4"
            onWheel={handleWheel}
            onClick={(e) => e.stopPropagation()}
          >
            {openIdx! > 0 && (
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60 sm:left-4"
                aria-label="Предыдущее фото"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            <img
              src={photo.url}
              alt={`Фото ${openIdx! + 1}`}
              draggable={false}
              className="max-h-full max-w-full select-none object-contain transition-transform duration-150 ease-out"
              style={{ transform: `scale(${zoom})` }}
            />
            {openIdx! < photos.length - 1 && (
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60 sm:right-4"
                aria-label="Следующее фото"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function AnswerCard({
  index,
  answer,
  draft,
  locked,
  saving,
  onChange,
  onSave,
}: {
  index: number;
  answer: AnswerReviewItem;
  draft: Draft;
  locked: boolean;
  saving: boolean;
  onChange: (d: Draft) => void;
  onSave: () => void;
}) {
  const isChoice = answer.type === 'SINGLE_CHOICE' || answer.type === 'MULTIPLE_CHOICE';

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Вопрос {index} · {TYPE_LABEL[answer.type]}
          {answer.topic ? ` · ${answer.topic}` : ''}
        </span>
        {isChoice && answer.autoScore != null && (
          <span className="text-xs text-slate-400">
            Авто: {answer.autoScore} / {answer.maxScore}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-slate-800">{answer.questionText}</p>

      {/* Applicant's answer */}
      {isChoice ? (
        <ul className="mt-3 space-y-1.5">
          {answer.options.map((o) => {
            const state = o.correct ? 'correct' : o.selected ? 'wrong' : 'neutral';
            return (
              <li
                key={o.id}
                className={cx(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1',
                  state === 'correct'
                    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                    : state === 'wrong'
                      ? 'bg-red-50 text-red-700 ring-red-200'
                      : 'bg-white text-slate-600 ring-slate-200',
                )}
              >
                {o.correct ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : o.selected ? (
                  <X className="h-4 w-4 shrink-0 text-red-500" />
                ) : (
                  <span className="h-4 w-4 shrink-0" />
                )}
                <span className="flex-1">{o.text}</span>
                {o.selected && (
                  <span className="text-xs font-medium opacity-70">выбрал ученик</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-3 space-y-2">
          {answer.applicantAnswer?.trim() ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Ответ ученика
              </p>
              <p className="whitespace-pre-wrap">{answer.applicantAnswer}</p>
            </div>
          ) : (answer.photos ?? []).length === 0 ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Ответ ученика
              </p>
              <p className="italic text-slate-400">Нет ответа</p>
            </div>
          ) : null}
          {(answer.photos ?? []).length > 0 && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Фото ({(answer.photos ?? []).length})
              </p>
              <ReviewPhotoGallery photos={answer.photos ?? []} />
            </div>
          )}
          {answer.referenceAnswer?.trim() && (
            <div className="rounded-lg bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Эталон
              </p>
              <p className="whitespace-pre-wrap">{answer.referenceAnswer}</p>
            </div>
          )}
        </div>
      )}

      {/* Length heuristic draft — not AI; admin must set the final score */}
      {!isChoice && answer.aiScore != null && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              Черновая эвристика
            </span>
            <span className="text-xs font-medium text-amber-900">
              Ориентир балла: {answer.aiScore} / {answer.maxScore}
            </span>
            {!locked && (
              <button
                type="button"
                onClick={() => onChange({ ...draft, score: String(answer.aiScore) })}
                className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                Подставить балл
              </button>
            )}
          </div>
          {(answer.aiComment || answer.aiWarning) && (
            <p className="mt-1.5 text-sm text-amber-900">
              {[answer.aiWarning, answer.aiComment].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}

      {/* Scoring */}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Балл (0–{answer.maxScore})
          </label>
          <input
            type="number"
            min={0}
            max={answer.maxScore}
            value={draft.score}
            disabled={locked}
            onChange={(e) => onChange({ ...draft, score: e.target.value })}
            className="input-base h-10 w-24"
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Комментарий (необязательно)
          </label>
          <input
            type="text"
            value={draft.comment}
            disabled={locked}
            onChange={(e) => onChange({ ...draft, comment: e.target.value })}
            placeholder="Комментарий к ответу…"
            className="input-base h-10"
          />
        </div>
        {!locked && (
          <Button size="sm" variant="secondary" loading={saving} onClick={onSave}>
            Сохранить
          </Button>
        )}
      </div>
      {answer.finalScore != null && (
        <p className="mt-2 text-xs text-emerald-600">
          <Check className="mr-1 inline h-3.5 w-3.5" />
          Выставлено: {answer.finalScore} / {answer.maxScore}
          {answer.adminComment ? ` · ${answer.adminComment}` : ''}
        </p>
      )}
    </div>
  );
}
