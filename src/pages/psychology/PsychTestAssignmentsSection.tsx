import { Link } from 'react-router-dom';
import { BarChart3, Lock, Send, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { usePsychTestAssignments } from '@/hooks/psychTestQueries';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { assignmentState, classesLabel, progressLabel } from '@/lib/psychTestModel';
import type { PsychTestAssignment } from '@/lib/psychTestsApi';
import { ROUTES } from '@/lib/routes';
import type { Test } from '@/lib/types';

/**
 * Назначения психологического теста ученикам — блок карточки теста (PSYCHOLOGIST-002).
 *
 * Окна назначения и подтверждения закрытия рисует карточка, а не этот блок: `Modal` не
 * выносится порталом, и окно внутри тела другого окна съехало бы под его анимацией.
 */
export function PsychTestAssignmentsSection({
  test,
  onAssign,
  onCloseAssignment,
}: {
  test: Test;
  onAssign: () => void;
  onCloseAssignment: (assignment: PsychTestAssignment) => void;
}) {
  const assignments = usePsychTestAssignments(test.id);
  const canAssign = test.status === 'ACTIVE';

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Users className="h-4 w-4 text-slate-400" /> Назначения ученикам
        </p>
        <div className="ml-auto">
          <Button size="sm" icon={<Send className="h-4 w-4" />} onClick={onAssign} disabled={!canAssign}>
            Назначить классам
          </Button>
        </div>
      </div>
      {!canAssign && (
        <p className="mb-2 text-xs text-slate-400">
          Назначить можно только активный тест — переведите его в статус «Активен».
        </p>
      )}

      {assignments.isLoading ? (
        <LoadingBlock label="Загрузка назначений…" />
      ) : assignments.isError ? (
        <ErrorBlock
          message={assignments.error instanceof ApiError ? assignments.error.message : 'Не удалось загрузить назначения'}
          onRetry={() => void assignments.refetch()}
        />
      ) : (assignments.data ?? []).length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-100">
          Тест ещё никому не назначен.
        </p>
      ) : (
        <ul className="space-y-2">
          {(assignments.data ?? []).map((assignment) => {
            const state = assignmentState(assignment);
            return (
              <li
                key={assignment.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-100 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{classesLabel(assignment) || '—'}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Назначено {formatDateTime(assignment.createdAt)}
                    {assignment.deadlineAt ? ` · срок до ${formatDateTime(assignment.deadlineAt)}` : ' · без срока'}
                  </p>
                </div>
                <Badge tone={state.tone}>{state.label}</Badge>
                <span className="text-sm text-slate-600">{progressLabel(assignment)}</span>
                <div className="flex items-center gap-1">
                  <Link
                    to={ROUTES.psychologistTestResults(test.id, assignment.id as number)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <BarChart3 className="h-4 w-4" /> Результаты
                  </Link>
                  {assignment.status === 'ACTIVE' && (
                    <button
                      onClick={() => onCloseAssignment(assignment)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    >
                      <Lock className="h-4 w-4" /> Закрыть приём
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
