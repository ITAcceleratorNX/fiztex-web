import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TextArea } from '@/components/ui/Field';
import { Spinner, ErrorBlock } from '@/components/ui/StateBlock';
import { formatDateTime } from '@/lib/format';
import type { AnswerReviewItem, ReviewDetail } from '@/lib/types';
import { AnswerReviewCard } from '@/components/review/AnswerReviewCard';
import { SuspiciousLog } from '@/components/review/SuspiciousLog';
import type { ScoreDraft } from '@/components/review/constants';

export function ReviewModal({
  open,
  attemptId,
  onClose,
  variant = 'modal',
}: {
  open: boolean;
  attemptId: number | null;
  onClose: () => void;
  variant?: 'modal' | 'page';
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const active = variant === 'page' ? attemptId != null : open;

  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, ScoreDraft>>({});
  const [schoolComment, setSchoolComment] = useState('');
  const [internalComment, setInternalComment] = useState('');
  const [savingQ, setSavingQ] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [opening, setOpening] = useState(false);
  const activeAttemptRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
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
  }, [active, attemptId]);

  function applyDetail(d: ReviewDetail) {
    setDetail(d);
    setSchoolComment(d.schoolComment ?? '');
    setInternalComment(d.internalComment ?? '');
    setDrafts((prev) => {
      const next = { ...prev };
      for (const a of d.answers) {
        if (next[a.questionId] === undefined) {
          const scoreSeed = a.finalScore ?? a.autoScore ?? a.aiScore ?? 0;
          next[a.questionId] = {
            score: String(scoreSeed),
            comment: a.adminComment ?? a.aiComment ?? '',
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
      qc.invalidateQueries({ queryKey: ['results'] });
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
      qc.invalidateQueries({ queryKey: ['results'] });
      toast.success('Результат открыт для просмотра');
    } catch (e) {
      if (activeAttemptRef.current !== attemptId) return;
      toast.error(e instanceof ApiError ? e.message : 'Не удалось открыть результат');
    } finally {
      if (activeAttemptRef.current === attemptId) setOpening(false);
    }
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={confirming || opening}>
        {variant === 'page' ? 'К списку результатов' : 'Закрыть'}
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

  const body = loading ? (
    <div className="flex justify-center py-16">
      <Spinner className="h-6 w-6 animate-spin text-brand-500" />
    </div>
  ) : loadError ? (
    <ErrorBlock message={loadError} />
  ) : detail ? (
    <div className="space-y-5">
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

      <SuspiciousLog logs={detail.suspiciousLogs} tabSwitchCount={detail.tabSwitchCount ?? 0} />

      <div className="space-y-4">
        {detail.answers.map((a, idx) => (
          <AnswerReviewCard
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
  ) : null;

  const title = detail ? `Проверка · ${detail.applicantName}` : 'Проверка ответов';
  const subtitle = detail ? `${detail.testTitle} · завершён ${formatDateTime(detail.finishedAt)}` : undefined;

  if (variant === 'page') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-slate-500">{subtitle}</p> : null}
        </div>

        <div className="card">
          <div className="px-6 py-5">{body}</div>
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            {footer}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={title}
      subtitle={subtitle}
      footer={footer}
    >
      {body}
    </Modal>
  );
}
