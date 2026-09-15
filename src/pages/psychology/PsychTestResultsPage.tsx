import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Field';
import { MathText } from '@/components/ui/MathText';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { useClosePsychTestAssignment, usePsychTestResults } from '@/hooks/psychTestQueries';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { answerLabel, assignmentState, classesLabel, RESPONSE_STATUS } from '@/lib/psychTestModel';
import type { PsychTestResultQuestion, PsychTestStudentResult } from '@/lib/psychTestsApi';
import { ROUTES } from '@/lib/routes';

/**
 * Именные результаты одного назначения психологического теста (PSYCHOLOGIST-002).
 *
 * Экран только читает. Ответы есть лишь у отправивших: черновик ученика — ещё не ответ, и
 * сервер его сюда не отдаёт. Сводка над таблицей считается по тем же строкам, что видны под
 * ней: сузили до класса — и цифры про этот класс.
 */
export function PsychTestResultsPage() {
  const params = useParams();
  const testId = Number(params.testId);
  const assignmentId = Number(params.assignmentId);
  const validIds = Number.isFinite(testId) && Number.isFinite(assignmentId);

  const toast = useToast();
  const [classId, setClassId] = useState<number | undefined>(undefined);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [confirmClose, setConfirmClose] = useState(false);

  const results = usePsychTestResults(validIds ? assignmentId : null, classId);
  const close = useClosePsychTestAssignment(testId);

  const assignment = results.data?.assignment;
  const questions = results.data?.questions ?? [];
  const students = results.data?.students ?? [];

  function toggle(studentId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function handleClose() {
    try {
      await close.mutateAsync(assignmentId);
      toast.success('Приём ответов закрыт');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось закрыть приём');
    } finally {
      setConfirmClose(false);
    }
  }

  const counts = {
    completed: students.filter((s) => s.status === 'COMPLETED').length,
    inProgress: students.filter((s) => s.status === 'IN_PROGRESS').length,
    notStarted: students.filter((s) => s.status === 'NOT_STARTED').length,
  };

  return (
    <div>
      <Link
        to={ROUTES.psychologistTests}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Психологические тесты
      </Link>

      {!validIds ? (
        <ErrorBlock message="Назначение не найдено" />
      ) : results.isLoading ? (
        <LoadingBlock label="Загрузка результатов…" />
      ) : results.isError || !assignment ? (
        <ErrorBlock
          message={results.error instanceof ApiError ? results.error.message : 'Не удалось загрузить результаты'}
          onRetry={() => void results.refetch()}
        />
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900">
                {assignment.testTitle}
              </h1>
              <p className="mt-1 text-slate-500">
                {classesLabel(assignment)} · назначено {formatDateTime(assignment.createdAt)}
                {assignment.deadlineAt ? ` · срок до ${formatDateTime(assignment.deadlineAt)}` : ' · без срока'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={assignmentState(assignment).tone}>{assignmentState(assignment).label}</Badge>
              {assignment.status === 'ACTIVE' && (
                <Button variant="secondary" icon={<Lock className="h-4 w-4" />} onClick={() => setConfirmClose(true)}>
                  Закрыть приём
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Учеников" value={students.length} />
            <StatCard label="Пройдено" value={counts.completed} />
            <StatCard label="В процессе" value={counts.inProgress} />
            <StatCard label="Не начато" value={counts.notStarted} />
          </div>

          <div className="card mt-6 overflow-hidden">
            {(assignment.classes ?? []).length > 1 && (
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-3">
                <Select
                  aria-label="Класс"
                  value={classId ?? ''}
                  onChange={(e) => {
                    setExpanded(new Set());
                    setClassId(e.target.value ? Number(e.target.value) : undefined);
                  }}
                  className="h-10 w-auto"
                >
                  <option value="">Все классы</option>
                  {(assignment.classes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {students.length === 0 ? (
              <EmptyBlock title="Учеников нет" description="В этом срезе назначения нет ни одного ученика." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <th className="w-10 px-3 py-3.5" />
                      <th className="px-3 py-3.5">Ученик</th>
                      <th className="px-6 py-3.5">Класс</th>
                      <th className="px-6 py-3.5">Статус</th>
                      <th className="px-6 py-3.5">Отправлено</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {students.map((student) => (
                      <StudentRow
                        key={student.studentId}
                        student={student}
                        questions={questions}
                        expanded={expanded.has(student.studentId as number)}
                        onToggle={() => toggle(student.studentId as number)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => void handleClose()}
        title="Закрыть приём ответов?"
        confirmLabel="Закрыть приём"
        loading={close.isPending}
        message="Отправленные ответы останутся. Ученики, которые не успели отправить свои, больше не смогут это сделать."
      />
    </div>
  );
}

function StudentRow({
  student,
  questions,
  expanded,
  onToggle,
}: {
  student: PsychTestStudentResult;
  questions: PsychTestResultQuestion[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const status = RESPONSE_STATUS[student.status ?? 'NOT_STARTED'];
  const submitted = student.status === 'COMPLETED';
  const answers = new Map((student.answers ?? []).map((a) => [a.questionId, a]));

  return (
    <Fragment>
      <tr className={submitted ? 'cursor-pointer transition hover:bg-slate-50/70' : undefined} onClick={submitted ? onToggle : undefined}>
        <td className="px-3 py-3.5 text-slate-400">
          {submitted &&
            (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
        </td>
        <td className="px-3 py-3.5 text-sm font-semibold text-slate-800">{student.studentName}</td>
        <td className="px-6 py-3.5 text-sm text-slate-600">{student.className}</td>
        <td className="px-6 py-3.5">
          <Badge tone={status.tone}>{status.label}</Badge>
        </td>
        <td className="px-6 py-3.5 text-sm text-slate-500">{submitted ? formatDateTime(student.submittedAt) : '—'}</td>
      </tr>
      {submitted && expanded && (
        <tr>
          <td />
          <td colSpan={4} className="px-3 pb-5 pt-1">
            <ol className="space-y-3">
              {questions.map((question, index) => {
                const label = answerLabel(question, answers.get(question.id));
                return (
                  <li key={question.id} className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                    <p className="text-sm font-medium text-slate-700">
                      {index + 1}. <MathText text={question.text} />
                    </p>
                    <p className={label ? 'mt-1 whitespace-pre-wrap text-sm text-slate-900' : 'mt-1 text-sm text-slate-400'}>
                      {label ?? 'Нет ответа'}
                    </p>
                  </li>
                );
              })}
            </ol>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
