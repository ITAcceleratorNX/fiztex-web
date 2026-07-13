import { useState } from 'react';
import { BookOpen, Clock, LogOut, RefreshCw, Trophy } from 'lucide-react';
import { EntranceShell } from './EntranceShell';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { pluralRu } from '@/lib/format';
import type { ApplicantView, AssignmentItem, EntranceListStatus } from '@/lib/entranceTypes';

const STATUS_META: Record<
  EntranceListStatus,
  { label: string; tone: 'gray' | 'blue' | 'amber' | 'green' }
> = {
  NOT_STARTED: { label: 'Не начат', tone: 'gray' },
  IN_PROGRESS: { label: 'В процессе', tone: 'blue' },
  AWAITING_REVIEW: { label: 'Ожидает проверки', tone: 'amber' },
  OPEN_FOR_VIEWING: { label: 'Результат доступен', tone: 'green' },
  UNAVAILABLE: { label: 'Недоступен', tone: 'gray' },
};

/** Section 6 — list of assigned tests. The applicant chooses which one to start first. */
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
    <EntranceShell size="lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Назначенные тесты</h1>
          <p className="mt-1 text-sm text-slate-500">
            {applicant.fullName} · {applicant.grade}
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={<LogOut className="h-4 w-4" />} onClick={onExit}>
          Выйти
        </Button>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        Вам назначено {assignments.length}{' '}
        {pluralRu(assignments.length, ['тест', 'теста', 'тестов'])}. Выберите, какой пройти.
      </p>

      <div className="mt-5 space-y-3">
        {assignments.map((item) => {
          const meta = STATUS_META[item.status] ?? STATUS_META.UNAVAILABLE;
          return (
            <div key={item.assignmentId} className="card p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 shrink-0 text-brand-500" />
                    <h2 className="truncate font-semibold text-slate-800">{item.testTitle}</h2>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                    <span>{item.subject}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {item.durationMinutes} мин
                    </span>
                    {item.testVersion != null && <span>Версия {item.testVersion}</span>}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={meta.tone} dot>
                    {meta.label}
                  </Badge>
                  {item.availableAction === 'START' && (
                    <Button size="sm" onClick={() => onStart(item)}>
                      Начать
                    </Button>
                  )}
                  {item.availableAction === 'CONTINUE' && (
                    <Button
                      size="sm"
                      loading={busyId === item.assignmentId}
                      onClick={() => handleContinue(item)}
                    >
                      Продолжить
                    </Button>
                  )}
                  {item.availableAction === 'VIEW_RESULT' && (
                    <Button
                      size="sm"
                      icon={<Trophy className="h-4 w-4" />}
                      loading={busyId === item.assignmentId}
                      onClick={() => handleViewResult(item)}
                    >
                      Посмотреть результат
                    </Button>
                  )}
                  {item.availableAction === 'NONE' && (
                    <Button size="sm" variant="secondary" disabled>
                      Недоступно
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onExit}
        className="mt-6 inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-600"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Ввести другой код
      </button>
    </EntranceShell>
  );
}
