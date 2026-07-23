import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, AlertTriangle, X } from 'lucide-react';
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

  const progressPct = Math.round(((index + 1) / questions.length) * 100);

  return (
    <EntranceShell variant="session">
      <div className="flex min-h-[100dvh] flex-col">
        <header className="shrink-0 bg-white px-5 pb-5 pt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[17px] font-bold text-navy-700">
              {attempt.subject || attempt.testTitle}
            </p>
            <div
              className={cx(
                'inline-flex shrink-0 items-center gap-1.5 text-[17px] font-bold tabular-nums',
                lowTime ? 'text-red-500' : 'text-brand-500',
              )}
            >
              <Clock className="size-[18px]" strokeWidth={2} />
              {formatClock(remaining)}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[13px] font-semibold text-[#64748b]">
            <span>
              Вопрос {index + 1} из {questions.length}
            </span>
            <span>{progressPct}% завершено</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
            <div
              className="h-full rounded-full bg-navy-700 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </header>

        {showTimeWarning && (
          <div className="mx-5 mt-3 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">До конца теста осталось {warnLabel}</p>
              <p className="mt-0.5 text-red-700">
                Проверьте ответы. После истечения времени тест отправится автоматически.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTimeWarning(false)}
              className="shrink-0 rounded-lg p-1 text-red-600"
              aria-label="Закрыть"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
          <div className="rounded-[28px] bg-white p-7 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
            <h2 className="text-center text-xl font-semibold leading-7 text-[#1e293b]">
              {question.text}
            </h2>
          </div>

          <div className="space-y-3">
            {question.type === 'SINGLE_CHOICE' &&
              question.options.map((opt) => {
                const checked = answer.selectedOptionIds.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={cx(
                      'flex h-16 cursor-pointer items-center gap-3 rounded-2xl border px-5 text-[17px] transition',
                      checked
                        ? 'border-2 border-navy-700 bg-[#eff6ff] font-bold text-[#1e293b]'
                        : 'border border-[#e2e8f0] bg-white font-medium text-[#1e293b]',
                    )}
                  >
                    <span
                      className={cx(
                        'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                        checked ? 'border-navy-700' : 'border-[#e2e8f0]',
                      )}
                    >
                      {checked ? <span className="size-3 rounded-full bg-navy-700" /> : null}
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
                      'flex h-16 cursor-pointer items-center gap-3 rounded-2xl border px-5 text-[17px] transition',
                      checked
                        ? 'border-2 border-navy-700 bg-[#eff6ff] font-bold text-[#1e293b]'
                        : 'border border-[#e2e8f0] bg-white font-medium text-[#1e293b]',
                    )}
                  >
                    <span
                      className={cx(
                        'flex size-6 shrink-0 items-center justify-center rounded-md border-2',
                        checked ? 'border-navy-700 bg-navy-700 text-white' : 'border-[#e2e8f0]',
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

            {question.type === 'OPEN_TEXT' && (
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

            <div className="flex justify-center pt-1">
              <SaveStatusChip
                status={currentSaveStatus}
                onRetry={
                  currentSaveStatus === 'error' ? () => void saveQuestion(question.id) : undefined
                }
              />
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-[#e2e8f0] bg-white px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5">
          <div className="flex gap-3">
            <button
              type="button"
              disabled={!allowBack || index === 0 || submitting}
              onClick={() => void goTo(index - 1)}
              className="inline-flex h-14 w-[120px] shrink-0 items-center justify-center rounded-2xl border-2 border-navy-700 text-[17px] font-semibold text-navy-700 transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Назад
            </button>
            {!isLast ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void goTo(index + 1)}
                className="inline-flex h-14 flex-1 items-center justify-center rounded-2xl bg-brand-500 text-[17px] font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                Далее
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(true)}
                className="inline-flex h-14 flex-1 items-center justify-center rounded-2xl bg-brand-500 text-[17px] font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                {submitting ? 'Отправка…' : 'Завершить'}
              </button>
            )}
          </div>
          {!isLast ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => setConfirmOpen(true)}
              className="mt-3 w-full text-center text-sm font-semibold text-[#64748b] underline-offset-2 hover:underline disabled:opacity-50"
            >
              Завершить тест
            </button>
          ) : null}
        </footer>
      </div>

      {showTabSwitchWarning && tabSwitchCount > 0 && (
        <div className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-[358px] items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-500">
            <AlertTriangle className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#1e293b]">Зафиксирован выход из окна теста</p>
            <p className="text-xs text-[#64748b]">Это событие будет передано школе</p>
          </div>
          <button
            type="button"
            onClick={dismissTabSwitchWarning}
            aria-label="Закрыть"
            className="flex size-[18px] shrink-0 items-center justify-center text-[#64748b]"
          >
            <X className="size-[15px]" strokeWidth={2} />
          </button>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-[390px] rounded-t-[24px] bg-white px-6 pb-[max(44px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_32px_rgba(0,0,0,0.1)]">
            <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-[#e2e8f0]" />
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-brand-500/10 text-brand-500">
                <AlertTriangle className="size-8" strokeWidth={2.5} />
              </div>
              <div className="space-y-2">
                <h3 className="text-[22px] font-bold text-[#1e293b]">Завершить тестирование?</h3>
                <p className="text-base leading-6 text-[#64748b]">
                  Вы ответили на{' '}
                  <span className="font-semibold text-[#1e293b]">
                    {answeredCount} из {questions.length}
                  </span>{' '}
                  вопросов. После завершения изменить ответы будет невозможно.
                </p>
              </div>
            </div>
            {unansweredCount > 0 && (
              <p className="mt-4 text-center text-sm text-amber-700">
                Без ответа: {unansweredCount}{' '}
                {pluralRu(unansweredCount, ['вопрос', 'вопроса', 'вопросов'])}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void confirmSubmit()}
                className="flex h-14 items-center justify-center rounded-2xl bg-brand-500 text-[17px] font-semibold text-white disabled:opacity-50"
              >
                Завершить тест
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex h-14 items-center justify-center rounded-2xl border-2 border-navy-700 text-[17px] font-semibold text-navy-700"
              >
                Вернуться к вопросам
              </button>
            </div>
          </div>
        </div>
      )}
    </EntranceShell>
  );
}
