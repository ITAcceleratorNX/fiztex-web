import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, ArrowLeft, ArrowRight, Flag, AlertTriangle } from 'lucide-react';
import { entranceApi } from '@/lib/entranceApi';
import { ApiError } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { cx, pluralRu } from '@/lib/format';
import { EntranceShell } from './EntranceShell';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAttemptEvents } from './useAttemptEvents';
import type { AttemptDetail, AttemptQuestion } from '@/lib/entranceTypes';

interface LocalAnswer {
  selectedOptionIds: number[];
  openTextAnswer: string;
}

function buildInitial(attempt: AttemptDetail): Record<number, LocalAnswer> {
  const map: Record<number, LocalAnswer> = {};
  for (const q of attempt.questions) map[q.id] = { selectedOptionIds: [], openTextAnswer: '' };
  for (const a of attempt.answers) {
    map[a.questionId] = {
      selectedOptionIds: a.selectedOptionIds ?? [],
      openTextAnswer: a.openTextAnswer ?? '',
    };
  }
  return map;
}

function serialize(a: LocalAnswer): string {
  return JSON.stringify({ s: [...a.selectedOptionIds].sort((x, y) => x - y), t: a.openTextAnswer });
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

/** Sections 8–11 — taking the test with a backend-driven timer, autosave and finish. */
export function AttemptScreen({
  attempt,
  onFinished,
}: {
  attempt: AttemptDetail;
  onFinished: () => void;
}) {
  const toast = useToast();
  const attemptId = attempt.attemptId;
  const questions = attempt.questions;
  const allowBack = attempt.allowBackNavigation;

  const [answers, setAnswers] = useState<Record<number, LocalAnswer>>(() => buildInitial(attempt));
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(attempt.remainingSeconds);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Keep the latest answers reachable from the timer / save callbacks without re-binding them.
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const saveTimers = useRef<Record<number, number>>({});
  const savedRef = useRef<Record<number, string>>({});
  const deadlineRef = useRef(Date.now() + attempt.remainingSeconds * 1000);
  const expiredRef = useRef(false);
  const submittingRef = useRef(false);

  const { tabSwitchCount, showTabSwitchWarning, dismissTabSwitchWarning } = useAttemptEvents(
    attemptId,
    !submitting,
    attempt.tabSwitchCount ?? 0,
  );

  // Seed "already saved" fingerprints so resumed answers are not needlessly re-sent.
  useEffect(() => {
    const seed: Record<number, string> = {};
    for (const a of attempt.answers) {
      seed[a.questionId] = serialize({
        selectedOptionIds: a.selectedOptionIds ?? [],
        openTextAnswer: a.openTextAnswer ?? '',
      });
    }
    savedRef.current = seed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveQuestion = useCallback(
    async (questionId: number) => {
      const question = questions.find((q) => q.id === questionId);
      if (!question) return;
      const answer = answersRef.current[questionId] ?? { selectedOptionIds: [], openTextAnswer: '' };
      const fingerprint = serialize(answer);
      if (savedRef.current[questionId] === fingerprint) return;
      try {
        const res = await entranceApi.saveAnswer(attemptId, {
          questionId,
          selectedOptionIds: question.type === 'OPEN_TEXT' ? undefined : answer.selectedOptionIds,
          openTextAnswer: question.type === 'OPEN_TEXT' ? answer.openTextAnswer : undefined,
        });
        savedRef.current[questionId] = fingerprint;
        // Resync the timer to the backend's authoritative remaining time (section 9).
        deadlineRef.current = Date.now() + res.remainingSeconds * 1000;
      } catch {
        /* Autosave is best-effort; the applicant can retry by editing again. */
      }
    },
    [attemptId, questions],
  );

  const finishByTimeout = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    await entranceApi.logEvent(attemptId, 'time_expired', 'client timer reached zero');
    try {
      await entranceApi.submitAttempt(attemptId);
    } catch {
      /* Backend may have already auto-finished on expiry — that is fine. */
    }
    toast.info('Время вышло. Тест отправлен на проверку.');
    onFinished();
  }, [attemptId, onFinished, toast]);

  // Single 1s ticker driven by the backend-synced deadline.
  useEffect(() => {
    const tick = () => {
      const secondsLeft = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setRemaining(secondsLeft);
      if (secondsLeft <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        void finishByTimeout();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [finishByTimeout]);

  function scheduleSave(questionId: number) {
    window.clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = window.setTimeout(() => void saveQuestion(questionId), 700);
  }

  function updateAnswer(questionId: number, next: LocalAnswer) {
    setAnswers((prev) => ({ ...prev, [questionId]: next }));
    scheduleSave(questionId);
  }

  function pickSingle(question: AttemptQuestion, optionId: number) {
    updateAnswer(question.id, {
      selectedOptionIds: [optionId],
      openTextAnswer: answersRef.current[question.id]?.openTextAnswer ?? '',
    });
  }

  function toggleMulti(question: AttemptQuestion, optionId: number) {
    const current = answersRef.current[question.id]?.selectedOptionIds ?? [];
    const next = current.includes(optionId)
      ? current.filter((id) => id !== optionId)
      : [...current, optionId];
    updateAnswer(question.id, {
      selectedOptionIds: next,
      openTextAnswer: answersRef.current[question.id]?.openTextAnswer ?? '',
    });
  }

  function setText(question: AttemptQuestion, text: string) {
    updateAnswer(question.id, {
      selectedOptionIds: answersRef.current[question.id]?.selectedOptionIds ?? [],
      openTextAnswer: text,
    });
  }

  async function goTo(nextIndex: number) {
    const currentId = questions[index].id;
    window.clearTimeout(saveTimers.current[currentId]);
    await saveQuestion(currentId);
    setIndex(nextIndex);
  }

  async function flushAll() {
    Object.values(saveTimers.current).forEach((t) => window.clearTimeout(t));
    await Promise.all(Object.keys(answersRef.current).map((k) => saveQuestion(Number(k))));
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
  const answer = answers[question.id] ?? { selectedOptionIds: [], openTextAnswer: '' };
  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    return a && (a.selectedOptionIds.length > 0 || a.openTextAnswer.trim().length > 0);
  }).length;
  const lowTime = remaining <= 60;
  const isLast = index === questions.length - 1;

  return (
    <EntranceShell size="lg">
      {/* Sticky header: title, progress, backend timer */}
      <div className="card sticky top-4 z-10 mb-4 flex items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{attempt.testTitle}</p>
          <p className="text-xs text-slate-500">
            Вопрос {index + 1} / {questions.length} · отвечено {answeredCount}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {tabSwitchCount > 0 && (
            <div
              className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200"
              title="Переключения вкладки фиксируются и передаются школе"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {tabSwitchCount}{' '}
              {pluralRu(tabSwitchCount, ['переключение', 'переключения', 'переключений'])}
            </div>
          )}
          <div
            className={cx(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums ring-1',
              lowTime
                ? 'bg-red-50 text-red-600 ring-red-200'
                : 'bg-slate-50 text-slate-700 ring-slate-200',
            )}
          >
            <Clock className="h-4 w-4" />
            {formatClock(remaining)}
          </div>
        </div>
      </div>

      {showTabSwitchWarning && tabSwitchCount > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Вы покинули вкладку с тестом</p>
            <p className="mt-0.5 text-amber-700">
              Переключений зафиксировано: {tabSwitchCount}. Школа видит эти данные при проверке.
              Пожалуйста, оставайтесь на этой вкладке до завершения теста.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissTabSwitchWarning}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
          >
            Понятно
          </button>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question card */}
      <div className="card p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Вопрос {index + 1}
        </p>
        <h2 className="mt-1.5 text-base font-semibold leading-relaxed text-slate-800">
          {question.text}
        </h2>

        <div className="mt-5 space-y-2.5">
          {question.type === 'SINGLE_CHOICE' &&
            question.options.map((opt) => {
              const checked = answer.selectedOptionIds.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className={cx(
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition',
                    checked
                      ? 'border-brand-400 bg-brand-50 text-slate-800 ring-1 ring-brand-400/30'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  )}
                >
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    className="h-4 w-4 accent-brand-500"
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
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition',
                    checked
                      ? 'border-brand-400 bg-brand-50 text-slate-800 ring-1 ring-brand-400/30'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-brand-500"
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

          {question.type === 'PHOTO' && (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">
              Фото-ответы недоступны в этой версии.
            </p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          icon={<ArrowLeft className="h-4 w-4" />}
          disabled={!allowBack || index === 0 || submitting}
          onClick={() => goTo(index - 1)}
        >
          Назад
        </Button>

        <div className="flex items-center gap-3">
          {!isLast && (
            <Button
              variant="secondary"
              icon={<ArrowRight className="h-4 w-4" />}
              disabled={submitting}
              onClick={() => goTo(index + 1)}
            >
              Далее
            </Button>
          )}
          <Button
            variant="primary"
            icon={<Flag className="h-4 w-4" />}
            loading={submitting}
            onClick={() => setConfirmOpen(true)}
          >
            Завершить тест
          </Button>
        </div>
      </div>

      {allowBack && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {questions.map((q, i) => {
            const a = answers[q.id];
            const done = a && (a.selectedOptionIds.length > 0 || a.openTextAnswer.trim().length > 0);
            return (
              <button
                key={q.id}
                onClick={() => goTo(i)}
                disabled={submitting}
                className={cx(
                  'h-8 w-8 rounded-lg text-xs font-semibold transition',
                  i === index
                    ? 'bg-brand-500 text-white'
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

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmSubmit}
        title="Завершить тест?"
        confirmLabel="Завершить"
        cancelLabel="Продолжить тест"
        message={
          <>
            После завершения тест будет отправлен на проверку школы и его нельзя будет пройти
            повторно. Отвечено на {answeredCount} из {questions.length} вопросов.
          </>
        }
      />
    </EntranceShell>
  );
}
