import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, ArrowLeft, ArrowRight, AlertTriangle, X } from 'lucide-react';
import { entranceApi } from '@/lib/entranceApi';
import { ApiError } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { cx, pluralRu } from '@/lib/format';
import { EntranceShell } from './EntranceShell';
import { TextArea } from '@/components/ui/Field';
import { useAttemptEvents } from './useAttemptEvents';
import { PhotoAnswerBlock } from './PhotoAnswerBlock';
import { SaveStatusChip, type SaveStatus } from './SaveStatusChip';
import type { AnswerPhotoRef, ApplicantView, AttemptDetail, AttemptQuestion } from '@/lib/entranceTypes';

interface LocalAnswer {
  selectedOptionIds: number[];
  openTextAnswer: string;
  photos: AnswerPhotoRef[];
}

function buildInitial(attempt: AttemptDetail): Record<number, LocalAnswer> {
  const map: Record<number, LocalAnswer> = {};
  for (const q of attempt.questions) {
    map[q.id] = { selectedOptionIds: [], openTextAnswer: '', photos: [] };
  }
  for (const a of attempt.answers) {
    map[a.questionId] = {
      selectedOptionIds: a.selectedOptionIds ?? [],
      openTextAnswer: a.openTextAnswer ?? '',
      photos: a.photos ?? [],
    };
  }
  return map;
}

function serialize(a: LocalAnswer): string {
  return JSON.stringify({
    s: [...a.selectedOptionIds].sort((x, y) => x - y),
    t: a.openTextAnswer,
    p: [...a.photos.map((photo) => photo.id)].sort((x, y) => x - y),
  });
}

function isQuestionAnswered(a: LocalAnswer | undefined): boolean {
  if (!a) return false;
  if (a.photos.length > 0) return true;
  if (a.selectedOptionIds.length > 0) return true;
  if (a.openTextAnswer.trim().length > 0) return true;
  return false;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

const CONNECTION_ISSUE_THROTTLE_MS = 60_000;
const SAVE_RETRY_DELAY_MS = 5_000;

/** Sections 8–11 — taking the test with a backend-driven timer, autosave and finish. */
export function AttemptScreen({
  attempt,
  applicant,
  onFinished,
  onExit,
}: {
  attempt: AttemptDetail;
  applicant?: ApplicantView | null;
  onFinished: () => void;
  onExit?: () => void;
}) {
  const toast = useToast();
  const attemptId = attempt.attemptId;
  const questions = attempt.questions;
  const allowBack = attempt.allowBackNavigation;

  const warnThreshold = attempt.durationMinutes >= 10 ? 600 : 60;
  const warnLabel =
    attempt.durationMinutes >= 10 ? '10 минут' : '1 минуту';

  const [answers, setAnswers] = useState<Record<number, LocalAnswer>>(() => buildInitial(attempt));
  const [saveStatus, setSaveStatus] = useState<Record<number, SaveStatus>>({});
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(attempt.remainingSeconds);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showTimeWarning, setShowTimeWarning] = useState(false);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const saveTimers = useRef<Record<number, number>>({});
  const retryTimers = useRef<Record<number, number>>({});
  const savedRef = useRef<Record<number, string>>({});
  const deadlineRef = useRef(Date.now() + attempt.remainingSeconds * 1000);
  const expiredRef = useRef(false);
  const submittingRef = useRef(false);
  const timeWarnShownRef = useRef(false);
  const lastConnectionIssueRef = useRef(0);

  const { tabSwitchCount, showTabSwitchWarning, dismissTabSwitchWarning } = useAttemptEvents(
    attemptId,
    !submitting,
    attempt.tabSwitchCount ?? 0,
  );

  useEffect(() => {
    const seed: Record<number, string> = {};
    for (const a of attempt.answers) {
      seed[a.questionId] = serialize({
        selectedOptionIds: a.selectedOptionIds ?? [],
        openTextAnswer: a.openTextAnswer ?? '',
        photos: a.photos ?? [],
      });
    }
    savedRef.current = seed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logConnectionIssue = useCallback(
    (detail = 'autosave failed') => {
      const now = Date.now();
      if (now - lastConnectionIssueRef.current < CONNECTION_ISSUE_THROTTLE_MS) return;
      lastConnectionIssueRef.current = now;
      void entranceApi.logEvent(attemptId, 'connection_issue', detail);
    },
    [attemptId],
  );

  const cancelSaveRetry = useCallback((questionId: number) => {
    window.clearTimeout(retryTimers.current[questionId]);
  }, []);

  const saveQuestionRef = useRef<(questionId: number) => Promise<void>>(async () => {});
  const flushAllRef = useRef<() => Promise<void>>(async () => {});

  const saveQuestion = useCallback(
    async (questionId: number) => {
      const question = questions.find((q) => q.id === questionId);
      if (!question) return;
      const answer = answersRef.current[questionId] ?? {
        selectedOptionIds: [],
        openTextAnswer: '',
        photos: [],
      };
      const fingerprint = serialize(answer);
      if (savedRef.current[questionId] === fingerprint) {
        setSaveStatus((prev) => ({ ...prev, [questionId]: 'saved' }));
        cancelSaveRetry(questionId);
        return;
      }
      setSaveStatus((prev) => ({ ...prev, [questionId]: 'saving' }));
      try {
        const res = await entranceApi.saveAnswer(attemptId, {
          questionId,
          selectedOptionIds: question.type === 'OPEN_TEXT' ? undefined : answer.selectedOptionIds,
          openTextAnswer: question.type === 'OPEN_TEXT' ? answer.openTextAnswer : undefined,
        });
        savedRef.current[questionId] = fingerprint;
        setSaveStatus((prev) => ({ ...prev, [questionId]: 'saved' }));
        cancelSaveRetry(questionId);
        deadlineRef.current = Date.now() + res.remainingSeconds * 1000;
      } catch {
        setSaveStatus((prev) => ({ ...prev, [questionId]: 'error' }));
        logConnectionIssue();
        cancelSaveRetry(questionId);
        retryTimers.current[questionId] = window.setTimeout(() => {
          void saveQuestionRef.current(questionId);
        }, SAVE_RETRY_DELAY_MS);
      }
    },
    [attemptId, questions, logConnectionIssue, cancelSaveRetry],
  );

  saveQuestionRef.current = saveQuestion;

  async function flushAll() {
    Object.values(saveTimers.current).forEach((t) => window.clearTimeout(t));
    await Promise.all(Object.keys(answersRef.current).map((k) => saveQuestion(Number(k))));
  }

  flushAllRef.current = flushAll;

  const finishByTimeout = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    await flushAllRef.current();
    await entranceApi.logEvent(attemptId, 'time_expired', 'client timer reached zero');
    try {
      await entranceApi.submitAttempt(attemptId);
    } catch {
      /* Backend may have already auto-finished on expiry — that is fine. */
    }
    toast.info('Время вышло. Тест отправлен на проверку.');
    onFinished();
  }, [attemptId, onFinished, toast]);

  useEffect(() => {
    const tick = () => {
      const secondsLeft = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setRemaining(secondsLeft);
      if (secondsLeft <= warnThreshold && secondsLeft > 0 && !timeWarnShownRef.current) {
        timeWarnShownRef.current = true;
        setShowTimeWarning(true);
      }
      if (secondsLeft <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        void finishByTimeout();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [finishByTimeout, warnThreshold]);

  function scheduleSave(questionId: number) {
    cancelSaveRetry(questionId);
    window.clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = window.setTimeout(() => void saveQuestion(questionId), 700);
  }

  function updateAnswer(questionId: number, next: LocalAnswer) {
    setAnswers((prev) => ({ ...prev, [questionId]: next }));
    scheduleSave(questionId);
  }

  function setPhotos(questionId: number, photos: AnswerPhotoRef[]) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] ?? { selectedOptionIds: [], openTextAnswer: '', photos: [] }),
        photos,
      },
    }));
    setSaveStatus((prev) => ({ ...prev, [questionId]: 'saved' }));
    savedRef.current[questionId] = serialize({
      ...(answersRef.current[questionId] ?? { selectedOptionIds: [], openTextAnswer: '', photos: [] }),
      photos,
    });
  }

  function pickSingle(question: AttemptQuestion, optionId: number) {
    const current = answersRef.current[question.id];
    updateAnswer(question.id, {
      selectedOptionIds: [optionId],
      openTextAnswer: current?.openTextAnswer ?? '',
      photos: current?.photos ?? [],
    });
  }

  function toggleMulti(question: AttemptQuestion, optionId: number) {
    const current = answersRef.current[question.id];
    const selected = current?.selectedOptionIds ?? [];
    const next = selected.includes(optionId)
      ? selected.filter((id) => id !== optionId)
      : [...selected, optionId];
    updateAnswer(question.id, {
      selectedOptionIds: next,
      openTextAnswer: current?.openTextAnswer ?? '',
      photos: current?.photos ?? [],
    });
  }

  function setText(question: AttemptQuestion, text: string) {
    const current = answersRef.current[question.id];
    updateAnswer(question.id, {
      selectedOptionIds: current?.selectedOptionIds ?? [],
      openTextAnswer: text,
      photos: current?.photos ?? [],
    });
  }

  async function goTo(nextIndex: number) {
    const currentId = questions[index].id;
    window.clearTimeout(saveTimers.current[currentId]);
    await saveQuestion(currentId);
    setIndex(nextIndex);
  }

  async function confirmSubmit() {
    setConfirmOpen(false);
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    await flushAll();
    try {
      await entranceApi.submitAttempt(attemptId);
      onFinished();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось завершить тест');
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const question = questions[index];
  const answer = answers[question.id] ?? { selectedOptionIds: [], openTextAnswer: '', photos: [] };
  const answeredCount = questions.filter((q) => isQuestionAnswered(answers[q.id])).length;
  const unansweredCount = questions.length - answeredCount;
  const lowTime = remaining <= warnThreshold;
  const isLast = index === questions.length - 1;
  const currentSaveStatus = saveStatus[question.id] ?? 'idle';

  return (
    <EntranceShell
      variant="session"
      size="lg"
      applicantName={applicant?.fullName}
      onExit={onExit}
    >
      <div className="relative space-y-4">
        {/* Progress + timer */}
        <div className="flex flex-col gap-4 rounded-[20px] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-navy-700">{attempt.subject || attempt.testTitle}</p>
            <p className="mt-0.5 text-sm text-slate-400">
              Вопрос {index + 1} из {questions.length}
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${((index + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>
          <div
            className={cx(
              'flex shrink-0 flex-col items-center justify-center rounded-2xl border px-5 py-3',
              lowTime ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white',
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Осталось
            </p>
            <p
              className={cx(
                'mt-0.5 flex items-center gap-1.5 text-xl font-bold tabular-nums',
                lowTime ? 'text-red-600' : 'text-navy-700',
              )}
            >
              <Clock className="size-4" />
              {formatClock(remaining)}
            </p>
          </div>
        </div>

        {showTimeWarning && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">До конца теста осталось {warnLabel}</p>
              <p className="mt-0.5 text-red-700">
                Проверьте ответы и завершите тест вовремя. После истечения времени тест отправится
                автоматически.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTimeWarning(false)}
              className="shrink-0 rounded-lg p-1 text-red-600 transition hover:bg-red-100"
              aria-label="Закрыть"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Question card */}
        <div className="rounded-[24px] bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.08)] sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Вопрос {index + 1}
          </p>
          <h2 className="mt-2 text-lg font-bold leading-snug text-[#1a1f36] sm:text-xl">
            {question.text}
          </h2>

          <div className="mt-6 space-y-3">
            {question.type === 'SINGLE_CHOICE' &&
              question.options.map((opt) => {
                const checked = answer.selectedOptionIds.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={cx(
                      'flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-sm transition',
                      checked
                        ? 'border-navy-700 bg-[#f0f4ff] text-[#1a1f36]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                    )}
                  >
                    <span
                      className={cx(
                        'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                        checked ? 'border-navy-700' : 'border-slate-300',
                      )}
                    >
                      {checked ? <span className="size-2.5 rounded-full bg-navy-700" /> : null}
                    </span>
                    <input
                      type="radio"
                      name={`q-${question.id}`}
                      className="sr-only"
                      checked={checked}
                      onChange={() => pickSingle(question, opt.id)}
                    />
                    {opt.text}
                  </label>
                );
              })}

            {question.type === 'MULTIPLE_CHOICE' &&
              question.options.map((opt) => {
                const checked = answer.selectedOptionIds.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={cx(
                      'flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-sm transition',
                      checked
                        ? 'border-navy-700 bg-[#f0f4ff] text-[#1a1f36]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                    )}
                  >
                    <span
                      className={cx(
                        'flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2',
                        checked ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-300',
                      )}
                    >
                      {checked ? (
                        <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden>
                          <path
                            d="M2.5 6.2L5 8.7L9.5 3.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleMulti(question, opt.id)}
                    />
                    {opt.text}
                  </label>
                );
              })}

            {(question.type === 'OPEN_TEXT' || question.type === 'PHOTO') &&
              question.type === 'OPEN_TEXT' && (
                <TextArea
                  value={answer.openTextAnswer}
                  onChange={(e) => setText(question, e.target.value)}
                  placeholder="Введите ответ…"
                  rows={5}
                />
              )}

            {question.type === 'PHOTO' && !question.allowPhoto && (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>Этот вопрос настроен некорректно. Обратитесь к сотруднику школы.</p>
              </div>
            )}

            {question.allowPhoto && (
              <PhotoAnswerBlock
                attemptId={attemptId}
                questionId={question.id}
                maxPhotos={question.maxPhotos ?? 1}
                photos={answer.photos}
                disabled={submitting}
                onPhotosChange={(photos) => setPhotos(question.id, photos)}
                onUploadFailed={() => logConnectionIssue('photo upload failed')}
              />
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <SaveStatusChip
              status={currentSaveStatus}
              onRetry={
                currentSaveStatus === 'error' ? () => void saveQuestion(question.id) : undefined
              }
            />
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                disabled={!allowBack || index === 0 || submitting}
                onClick={() => void goTo(index - 1)}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl border-[1.5px] border-brand-500 px-4 text-sm font-semibold text-brand-500 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="size-4" />
                Назад
              </button>
              {!isLast ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void goTo(index + 1)}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white shadow-[0_8px_8px_rgba(251,146,60,0.19)] transition hover:bg-brand-600 disabled:opacity-50"
                >
                  Далее
                  <ArrowRight className="size-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setConfirmOpen(true)}
                  className="inline-flex h-11 items-center rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white shadow-[0_8px_8px_rgba(251,146,60,0.19)] transition hover:bg-brand-600 disabled:opacity-50"
                >
                  {submitting ? 'Отправка…' : 'Завершить тест'}
                </button>
              )}
            </div>
          </div>

          {allowBack && (
            <div className="mt-6 flex flex-wrap gap-1.5 border-t border-slate-100 pt-5">
              {questions.map((q, i) => {
                const done = isQuestionAnswered(answers[q.id]);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => void goTo(i)}
                    disabled={submitting}
                    className={cx(
                      'h-8 w-8 rounded-lg text-xs font-semibold transition',
                      i === index
                        ? 'bg-navy-700 text-white'
                        : done
                          ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 hover:bg-emerald-100'
                          : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50',
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Always show finish control if not last and allow finishing from any question */}
        {!isLast && (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setConfirmOpen(true)}
              className="text-sm font-semibold text-white/80 underline-offset-2 transition hover:text-white hover:underline disabled:opacity-50"
            >
              Завершить тест
            </button>
          </div>
        )}
      </div>

      {showTabSwitchWarning && tabSwitchCount > 0 && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
          <div className="flex">
            <div className="w-1.5 shrink-0 bg-brand-500" />
            <div className="flex gap-3 p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                !
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#1a1f36]">
                  Зафиксирован выход из окна теста
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Система обнаружила, что окно тестирования было покинуто. Это событие будет
                  передано школе после завершения проверки.
                </p>
                <button
                  type="button"
                  onClick={dismissTabSwitchWarning}
                  className="mt-2 text-xs font-semibold text-brand-500 hover:text-brand-600"
                >
                  Понятно
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-[0_24px_64px_rgba(0,0,0,0.25)] sm:p-8">
            <h3 className="text-xl font-bold text-[#1a1f36]">Завершить тест?</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              После завершения тест будет отправлен на проверку школы и его нельзя будет пройти
              повторно. Отвечено на {answeredCount} из {questions.length} вопросов.
            </p>
            {unansweredCount > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                <p className="text-sm font-semibold">
                  Внимание: {unansweredCount}{' '}
                  {pluralRu(unansweredCount, ['вопрос', 'вопроса', 'вопросов'])} без ответа
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Вы всё равно можете завершить тест — пустые ответы останутся незаполненными.
                </p>
              </div>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl border-[1.5px] border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Продолжить тест
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void confirmSubmit()}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white shadow-[0_8px_8px_rgba(251,146,60,0.19)] transition hover:bg-brand-600 disabled:opacity-50"
              >
                Завершить
              </button>
            </div>
          </div>
        </div>
      )}
    </EntranceShell>
  );
}
