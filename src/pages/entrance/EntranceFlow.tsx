import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  clearEntranceSession,
  entranceApi,
  getActiveAttemptId,
  getEntranceToken,
  setActiveAttemptId,
} from '@/lib/entranceApi';
import { useToast } from '@/context/ToastContext';
import { LoadingBlock } from '@/components/ui/StateBlock';
import { EntranceShell } from './EntranceShell';
import { CodeScreen } from './CodeScreen';
import { ConfirmScreen } from './ConfirmScreen';
import { AssignmentsScreen } from './AssignmentsScreen';
import { InstructionScreen } from './InstructionScreen';
import { AttemptScreen } from './AttemptScreen';
import { FinishedScreen } from './FinishedScreen';
import { ResultScreen } from './ResultScreen';
import type { ApplicantView, ApplicantResult, AssignmentItem, AttemptDetail, AttemptStatus } from '@/lib/entranceTypes';

type Screen = 'loading' | 'code' | 'confirm' | 'list' | 'instruction' | 'attempt' | 'finished' | 'result';

const FINISHED_STATUSES: AttemptStatus[] = [
  'AWAITING_REVIEW',
  'REVIEWED',
  'COMPLETED',
  'OPEN_FOR_VIEWING',
];

/**
 * Orchestrates the whole applicant flow (TZ section 3). Kept as a client-side state machine over a
 * few screens; the backend remains the source of truth for answers, status and the timer. The
 * applicant session token + active attempt id live in sessionStorage so a refresh keeps the user in
 * the flow and re-loads state from the backend (AC #10, #11).
 */
export function EntranceFlow() {
  const toast = useToast();
  const [screen, setScreen] = useState<Screen>('loading');
  const [applicant, setApplicant] = useState<ApplicantView | null>(null);
  const [personalCode, setPersonalCode] = useState('');
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [selected, setSelected] = useState<AssignmentItem | null>(null);
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [result, setResult] = useState<ApplicantResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Responsive viewport for the applicant flow — the admin panel keeps its fixed 1280px layout.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const previous = meta?.getAttribute('content') ?? null;
    meta?.setAttribute('content', 'width=device-width, initial-scale=1');
    return () => {
      if (meta && previous) meta.setAttribute('content', previous);
    };
  }, []);

  const loadAssignments = useCallback(async () => {
    const list = await entranceApi.getAssignments();
    setApplicant(list.applicant);
    setAssignments(list.assignments);
    return list;
  }, []);

  // Bootstrap: resume from a persisted session/attempt if present.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getEntranceToken()) {
        setScreen('code');
        return;
      }
      try {
        const attemptId = getActiveAttemptId();
        if (attemptId != null) {
          const detail = await entranceApi.getAttempt(attemptId);
          if (cancelled) return;
          if (detail.status === 'IN_PROGRESS') {
            setAttempt(detail);
            try {
              const list = await loadAssignments();
              if (!cancelled) setApplicant(list.applicant);
            } catch {
              /* header name is optional */
            }
            if (cancelled) return;
            setScreen('attempt');
            return;
          }
          if (detail.status === 'OPEN_FOR_VIEWING') {
            setActiveAttemptId(null);
            await loadAssignments();
            if (cancelled) return;
            setScreen('list');
            return;
          }
          if (FINISHED_STATUSES.includes(detail.status)) {
            setAttempt(detail);
            setScreen('finished');
            return;
          }
          setActiveAttemptId(null);
        }
        await loadAssignments();
        if (cancelled) return;
        setScreen('list');
      } catch {
        if (cancelled) return;
        clearEntranceSession();
        setScreen('code');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAssignments]);

  const enterAttempt = useCallback((detail: AttemptDetail) => {
    setAttempt(detail);
    setActiveAttemptId(detail.attemptId);
    setScreen('attempt');
  }, []);

  function handleVerified(view: ApplicantView, code: string) {
    setApplicant(view);
    setPersonalCode(code);
    setScreen('confirm');
  }

  async function handleConfirmed() {
    setBusy(true);
    try {
      await loadAssignments();
      setScreen('list');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить тесты');
    } finally {
      setBusy(false);
    }
  }

  function handleExit() {
    clearEntranceSession();
    setApplicant(null);
    setPersonalCode('');
    setAssignments([]);
    setAttempt(null);
    setResult(null);
    setSelected(null);
    setScreen('code');
  }

  function handleStart(item: AssignmentItem) {
    setSelected(item);
    setScreen('instruction');
  }

  const beginAttempt = useCallback(
    async (assignmentId: number) => {
      const detail = await entranceApi.startAttempt(assignmentId);
      enterAttempt(detail);
    },
    [enterAttempt],
  );

  async function handleBeginFromInstruction() {
    if (!selected) return;
    setBusy(true);
    try {
      await beginAttempt(selected.assignmentId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось начать тест');
    } finally {
      setBusy(false);
    }
  }

  async function handleContinue(item: AssignmentItem) {
    try {
      await beginAttempt(item.assignmentId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось открыть тест');
    }
  }

  function handleFinished() {
    setScreen('finished');
  }

  async function handleViewResult(item: AssignmentItem) {
    try {
      const data = await entranceApi.getResult(item.assignmentId);
      setResult(data);
      setSelected(item);
      setScreen('result');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить результат');
    }
  }

  async function handleBackToList() {
    setActiveAttemptId(null);
    setAttempt(null);
    setResult(null);
    setSelected(null);
    setBusy(true);
    try {
      await loadAssignments();
      setScreen('list');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить тесты');
    } finally {
      setBusy(false);
    }
  }

  if (screen === 'loading') {
    return (
      <EntranceShell variant="auth">
        <div className="rounded-[32px] bg-white p-16 shadow-[0px_8px_24px_0px_rgba(39,65,133,0.13),0px_32px_64px_0px_rgba(0,0,0,0.13)]">
          <LoadingBlock />
        </div>
      </EntranceShell>
    );
  }

  if (screen === 'code') {
    return <CodeScreen onVerified={handleVerified} />;
  }

  if (screen === 'confirm' && applicant) {
    return (
      <ConfirmScreen
        applicant={applicant}
        personalCode={personalCode}
        onConfirm={handleConfirmed}
        onBack={handleExit}
        loading={busy}
      />
    );
  }

  if (screen === 'list' && applicant) {
    return (
      <AssignmentsScreen
        applicant={applicant}
        assignments={assignments}
        onStart={handleStart}
        onContinue={handleContinue}
        onViewResult={handleViewResult}
        onExit={handleExit}
      />
    );
  }

  if (screen === 'instruction' && selected && applicant) {
    return (
      <InstructionScreen
        item={selected}
        applicant={applicant}
        onBegin={handleBeginFromInstruction}
        onBack={() => setScreen('list')}
        onExit={handleExit}
        loading={busy}
      />
    );
  }

  if (screen === 'attempt' && attempt) {
    return (
      <AttemptScreen
        key={attempt.attemptId}
        attempt={attempt}
        applicant={applicant}
        onFinished={handleFinished}
        onExit={handleExit}
      />
    );
  }

  if (screen === 'finished') {
    return (
      <FinishedScreen
        attempt={attempt}
        applicant={applicant}
        onBackToList={handleBackToList}
        onExit={handleExit}
      />
    );
  }

  if (screen === 'result' && result) {
    return (
      <ResultScreen
        result={result}
        applicant={applicant}
        onBack={handleBackToList}
        onExit={handleExit}
      />
    );
  }

  // Fallback — should not happen, but never leave the applicant stuck.
  return <CodeScreen onVerified={handleVerified} />;
}
