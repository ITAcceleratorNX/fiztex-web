import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ListChecks, Pencil, Trash2, UserPlus } from 'lucide-react';
import { useDeleteTest, useTest, useChangeAssignmentVersion } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { CopyCode } from '@/components/ui/CopyCode';
import { Select } from '@/components/ui/Select';
import { TestStatusBadge } from '@/components/ui/TestStatusBadge';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TestFormModal } from '@/pages/modals/TestFormModal';
import { TestQuestionsModal } from '@/pages/modals/TestQuestionsModal';
import { AssignModal } from '@/pages/modals/AssignModal';
import { AssignSuccessModal } from '@/pages/modals/AssignSuccessModal';
import { formatDate, formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/api';
import type { Test, TestVersionSummary } from '@/lib/types';

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function VersionChip({ versionNumber }: { versionNumber: number | null }) {
  return (
    <span className="inline-flex items-center rounded-md bg-navy-700 px-2 py-0.5 text-xs font-semibold text-white">
      v{versionNumber ?? '—'}
    </span>
  );
}

function AssignmentVersionSelect({
  testId,
  assignmentId,
  currentVersion,
  versions,
  onChanged,
}: {
  testId: number;
  assignmentId: number;
  currentVersion: number | null;
  versions: TestVersionSummary[];
  onChanged: () => void;
}) {
  const changeVersion = useChangeAssignmentVersion(testId);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Select
        className="h-9 w-auto min-w-[7rem] py-1 text-xs"
        value={String(currentVersion ?? '')}
        disabled={changeVersion.isPending}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!next || next === currentVersion) return;
          setError(null);
          changeVersion.mutate(
            { assignmentId, versionNumber: next },
            {
              onSuccess: () => onChanged(),
              onError: (err) =>
                setError(err instanceof ApiError ? err.message : 'Не удалось сменить версию'),
            },
          );
        }}
      >
        {versions.map((v) => (
          <option key={v.id} value={v.versionNumber}>
            v{v.versionNumber}
          </option>
        ))}
      </Select>
      {error && <span className="max-w-[10rem] text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function TestDetailPage() {
  const { testId: testIdParam } = useParams();
  const testId = Number(testIdParam);
  const navigate = useNavigate();
  const toast = useToast();

  const { data: test, isLoading, isError, error, refetch } = useTest(Number.isFinite(testId) ? testId : null);
  const del = useDeleteTest();

  const [editOpen, setEditOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSuccessCount, setAssignSuccessCount] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete(current: Test) {
    try {
      await del.mutateAsync(current.id);
      toast.success('Тест удалён');
      navigate('/admissions?tab=tests', { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить тест');
      setDeleteOpen(false);
    }
  }

  if (!Number.isFinite(testId) || testId <= 0) {
    return <ErrorBlock message="Некорректный идентификатор теста." />;
  }

  return (
    <div>
      <Link
        to="/admissions?tab=tests"
        className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        К вступительным тестам
      </Link>

      {isLoading ? (
        <div className="card">
          <LoadingBlock label="Загрузка теста…" />
        </div>
      ) : isError || !test ? (
        <div className="card">
          <ErrorBlock message={error instanceof ApiError ? error.message : 'Не удалось загрузить тест'} onRetry={refetch} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
              {test.title}
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuestionsOpen(true)}
                title="Вопросы теста"
                className="rounded-xl p-2.5 text-slate-400 transition hover:bg-white hover:text-slate-700"
              >
                <ListChecks className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                title="Удалить тест"
                className="rounded-xl p-2.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
                Редактировать
              </Button>
            </div>
          </div>

          <div className="card mt-6 grid grid-cols-2 gap-x-6 gap-y-5 px-6 py-5 sm:grid-cols-3 lg:grid-cols-4">
            <InfoField label="Предмет" value={test.subjectName} />
            <InfoField label="Класс поступления" value={test.grade} />
            <InfoField label="Длительность" value={`${test.durationMinutes} минут`} />
            <div className="flex items-start justify-end lg:col-start-4">
              <TestStatusBadge status={test.status} />
            </div>
            <InfoField label="Минимальный балл" value={`${test.minScore} баллов`} />
            <InfoField
              label="Проходной процент"
              value={test.minPercent != null ? `${test.minPercent}%` : '—'}
            />
            <div className="col-span-2 flex items-end justify-end text-sm text-slate-400 sm:col-span-1 lg:col-span-2">
              Текущая версия: v{test.currentVersionNumber ?? 1} · {formatDateTime(test.currentVersionCreatedAt)}
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Версии теста</h2>
              <Badge tone="gray">{test.versions.length}</Badge>
            </div>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-6 py-3.5">Версия</th>
                    <th className="px-6 py-3.5">Дата создания</th>
                    <th className="px-6 py-3.5">Статус</th>
                    <th className="px-6 py-3.5">Назначений</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {test.versions.map((v) => (
                    <tr key={v.id} className="transition hover:bg-slate-50/70">
                      <td className="px-6 py-3.5">
                        <VersionChip versionNumber={v.versionNumber} />
                      </td>
                      <td className="px-6 py-3.5 text-sm text-slate-600">{formatDateTime(v.createdAt)}</td>
                      <td className="px-6 py-3.5">
                        {v.versionNumber === test.currentVersionNumber ? (
                          <Badge tone="green" dot>Активна</Badge>
                        ) : (
                          <Badge tone="gray" dot>Архив</Badge>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-sm font-semibold text-slate-700">
                        {test.assignments.filter((a) => a.versionNumber === v.versionNumber).length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Назначенные поступающие</h2>
                <Badge tone="gray">{test.assignments.length}</Badge>
              </div>
              <Button
                icon={<UserPlus className="h-4 w-4" />}
                disabled={test.status !== 'ACTIVE'}
                onClick={() => setAssignOpen(true)}
              >
                Назначить поступающих
              </Button>
            </div>
            <div className="card overflow-hidden">
              {test.assignments.length === 0 ? (
                <EmptyBlock title="Пока никого не назначено" description="Нажмите «Назначить поступающих»." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-6 py-3.5">ФИО</th>
                        <th className="px-6 py-3.5">Класс</th>
                        <th className="px-6 py-3.5">Персональный код</th>
                        <th className="px-6 py-3.5">Версия</th>
                        <th className="px-6 py-3.5">Дата назначения</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {test.assignments.map((a) => (
                        <tr key={a.id} className="transition hover:bg-slate-50/70">
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar name={a.applicantName} size="sm" />
                              <span className="font-semibold text-slate-800">{a.applicantName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-sm text-slate-600">{a.grade}</td>
                          <td className="px-6 py-3.5">
                            <CopyCode code={a.accessCode} />
                          </td>
                          <td className="px-6 py-3.5">
                            {a.canChangeVersion && test.versions.length > 1 ? (
                              <AssignmentVersionSelect
                                testId={test.id}
                                assignmentId={a.id}
                                currentVersion={a.versionNumber}
                                versions={test.versions}
                                onChanged={() => void refetch()}
                              />
                            ) : (
                              <VersionChip versionNumber={a.versionNumber} />
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-sm text-slate-500">{formatDate(a.assignedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <TestFormModal open={editOpen} onClose={() => setEditOpen(false)} test={test} aiTest={false} />
          <TestQuestionsModal open={questionsOpen} onClose={() => setQuestionsOpen(false)} testId={test.id} />
          <AssignModal
            open={assignOpen}
            onClose={() => setAssignOpen(false)}
            test={test}
            onAssigned={(count) => {
              setAssignOpen(false);
              setAssignSuccessCount(count);
            }}
          />
          <AssignSuccessModal
            open={assignSuccessCount != null}
            count={assignSuccessCount ?? 0}
            versionNumber={test.currentVersionNumber}
            onClose={() => setAssignSuccessCount(null)}
          />
          <ConfirmDialog
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            onConfirm={() => void handleDelete(test)}
            title="Удалить тест?"
            confirmLabel="Удалить"
            danger
            loading={del.isPending}
            message={
              <>
                Тест <b>«{test.title}»</b> вместе со всеми вопросами и версиями будет удалён
                безвозвратно. Это действие нельзя отменить.
              </>
            }
          />
        </>
      )}
    </div>
  );
}
