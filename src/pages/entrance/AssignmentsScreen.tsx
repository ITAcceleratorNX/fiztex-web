import { useState } from 'react';
import { FileText } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import { cx } from '@/lib/format';
import type { ApplicantView, AssignmentItem, EntranceListStatus } from '@/lib/entranceTypes';

const STATUS_LABEL: Record<EntranceListStatus, string> = {
  NOT_STARTED: 'Не начат',
  IN_PROGRESS: 'В процессе',
  AWAITING_REVIEW: 'На проверке',
  OPEN_FOR_VIEWING: 'Завершён',
  UNAVAILABLE: 'Недоступен',
};

function formatGrade(grade: string): string {
  const trimmed = grade.trim();
  if (!trimmed) return '';
  if (/класс/i.test(trimmed)) return trimmed;
  return `${trimmed} класс`;
}

/** Section 6 — list of assigned tests (Figma «Мои тесты»). */
export function AssignmentsScreen({
  applicant,
  assignments,
  onStart,
  onContinue,
  onViewResult,
  onExit,
}: {
  applicant: ApplicantView;
  assignments: AssignmentItem[];
  onStart: (item: AssignmentItem) => void;
  onContinue: (item: AssignmentItem) => Promise<void>;
  onViewResult: (item: AssignmentItem) => Promise<void>;
  onExit: () => void;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);

  async function handleContinue(item: AssignmentItem) {
    setBusyId(item.assignmentId);
    try {
      await onContinue(item);
    } finally {
      setBusyId(null);
    }
  }

  async function handleViewResult(item: AssignmentItem) {
    setBusyId(item.assignmentId);
    try {
      await onViewResult(item);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <EntranceShell
      variant="portal"
      size="lg"
      applicantName={applicant.fullName}
      onExit={onExit}
    >
      <h1 className="text-[28px] font-bold tracking-tight text-navy-700">Мои тесты</h1>

      {assignments.length === 0 ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-navy-50 text-navy-400">
            <FileText className="size-9" strokeWidth={1.5} />
          </div>
          <p className="mt-5 text-lg font-bold text-navy-700">Нет назначенных тестов</p>
          <p className="mt-2 max-w-sm text-sm text-slate-400">
            После назначения тестов они появятся на этой странице.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((item) => (
            <TestCard
              key={item.assignmentId}
              item={item}
              gradeLabel={formatGrade(applicant.grade)}
              busy={busyId === item.assignmentId}
              onStart={() => onStart(item)}
              onContinue={() => void handleContinue(item)}
              onViewResult={() => void handleViewResult(item)}
            />
          ))}
        </div>
      )}
    </EntranceShell>
  );
}

function TestCard({
  item,
  gradeLabel,
  busy,
  onStart,
  onContinue,
  onViewResult,
}: {
  item: AssignmentItem;
  gradeLabel: string;
  busy: boolean;
  onStart: () => void;
  onContinue: () => void;
  onViewResult: () => void;
}) {
  const mutedCover =
    item.status === 'AWAITING_REVIEW' || item.status === 'UNAVAILABLE';

  return (
    <article className="flex flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_8px_24px_rgba(39,65,133,0.08)]">
      <div
        className={cx(
          'relative h-[110px] overflow-hidden',
          mutedCover
            ? 'bg-gradient-to-br from-slate-400 to-slate-500'
            : 'bg-gradient-to-br from-navy-600 to-navy-800',
        )}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, white 1.5px, transparent 1.6px), radial-gradient(circle at 70% 60%, white 1.5px, transparent 1.6px)',
            backgroundSize: '48px 48px',
          }}
        />
        <span className="absolute right-3 top-3 rounded-full bg-brand-500 px-2.5 py-1 text-[11px] font-semibold text-white">
          {STATUS_LABEL[item.status]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <h2 className="text-lg font-bold text-[#1a1f36]">{item.testTitle}</h2>
        {gradeLabel ? <p className="text-sm text-slate-400">{gradeLabel}</p> : null}
        <p className="text-xs text-slate-400">
          {item.subject} · {item.durationMinutes} мин
        </p>

        <div className="mt-4">
          {item.availableAction === 'START' && (
            <CardButton onClick={onStart} tone="primary">
              Начать
            </CardButton>
          )}
          {item.availableAction === 'CONTINUE' && (
            <CardButton onClick={onContinue} tone="primary" disabled={busy}>
              {busy ? 'Загрузка…' : 'Продолжить'}
            </CardButton>
          )}
          {item.availableAction === 'VIEW_RESULT' && (
            <CardButton onClick={onViewResult} tone="success" disabled={busy}>
              {busy ? 'Загрузка…' : 'Посмотреть результаты'}
            </CardButton>
          )}
          {item.availableAction === 'NONE' && item.status === 'AWAITING_REVIEW' && (
            <CardButton tone="muted" disabled>
              Результат будет позже
            </CardButton>
          )}
          {item.availableAction === 'NONE' && item.status !== 'AWAITING_REVIEW' && (
            <CardButton tone="muted" disabled>
              Назначение закрыто
            </CardButton>
          )}
        </div>
      </div>
    </article>
  );
}

function CardButton({
  children,
  onClick,
  tone,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone: 'primary' | 'success' | 'muted';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition disabled:cursor-not-allowed',
        tone === 'primary' && 'bg-navy-700 text-white hover:bg-navy-800',
        tone === 'success' && 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
        tone === 'muted' && 'bg-slate-100 text-slate-400',
      )}
    >
      {children}
    </button>
  );
}
