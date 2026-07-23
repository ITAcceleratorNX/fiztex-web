import { useState } from 'react';
import { FileText } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import { cx } from '@/lib/format';
import type { ApplicantView, AssignmentItem, EntranceListStatus } from '@/lib/entranceTypes';

const STATUS_LABEL: Record<EntranceListStatus, string> = {
  NOT_STARTED: '',
  IN_PROGRESS: 'В процессе',
  AWAITING_REVIEW: 'На проверке',
  OPEN_FOR_VIEWING: 'Результат доступен',
  UNAVAILABLE: 'Недоступен',
};

function formatGrade(grade: string): string {
  const trimmed = grade.trim();
  if (!trimmed) return '';
  if (/класс/i.test(trimmed)) return trimmed;
  return `${trimmed} класс`;
}

/** Mobile list — Figma `phystech-mobile-v2` (105:2923). */
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
    <EntranceShell variant="portal" applicantName={applicant.fullName} onExit={onExit}>
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
        <div className="flex flex-col gap-3.5">
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
    item.status === 'AWAITING_REVIEW' ||
    item.status === 'UNAVAILABLE' ||
    item.status === 'OPEN_FOR_VIEWING';
  const statusText = STATUS_LABEL[item.status];

  return (
    <article className="flex flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_6px_20px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.02)]">
      <div
        className={cx(
          'relative h-[72px] overflow-hidden',
          mutedCover
            ? 'bg-gradient-to-br from-slate-400 to-slate-500'
            : 'bg-gradient-to-br from-navy-600 to-navy-800',
        )}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 40%, white 2px, transparent 2.5px), radial-gradient(circle at 55% 70%, white 2px, transparent 2.5px), radial-gradient(circle at 82% 35%, white 2px, transparent 2.5px)',
            backgroundSize: '56px 48px',
          }}
        />
      </div>

      <div className="flex flex-col gap-2 px-4 pb-4 pt-3.5">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold text-[#111827]">{item.testTitle}</h2>
          {gradeLabel ? <p className="text-[13px] text-[#6b7280]">{gradeLabel}</p> : null}
        </div>
        <p className="text-xs text-[#9ca3af]">
          {item.subject} · {item.durationMinutes} мин
        </p>

        <div className="mt-2 flex flex-col gap-3">
          {statusText && item.availableAction === 'CONTINUE' ? (
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand-500">
              {statusText}
            </p>
          ) : null}
          {statusText && item.availableAction === 'NONE' && item.status === 'AWAITING_REVIEW' ? (
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">
              {statusText}
            </p>
          ) : null}

          {item.availableAction === 'START' && (
            <CardButton onClick={onStart} tone="orange">
              Начать
            </CardButton>
          )}
          {item.availableAction === 'CONTINUE' && (
            <CardButton onClick={onContinue} tone="navy" disabled={busy}>
              {busy ? 'Загрузка…' : 'Продолжить'}
            </CardButton>
          )}
          {item.availableAction === 'VIEW_RESULT' && (
            <CardButton onClick={onViewResult} tone="success" disabled={busy}>
              {busy ? 'Загрузка…' : 'Посмотреть результат'}
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
  tone: 'orange' | 'navy' | 'success' | 'muted';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed',
        tone === 'orange' && 'bg-brand-500 text-white hover:bg-brand-600',
        tone === 'navy' && 'bg-navy-700 text-white hover:bg-navy-800',
        tone === 'success' && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
        tone === 'muted' && 'bg-[#e5e7eb] text-[#6b7280]',
      )}
    >
      {children}
    </button>
  );
}
