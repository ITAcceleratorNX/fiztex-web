import { useState, type ReactNode } from 'react';
import { UserPlus, Clock, Target, Repeat, Percent, History, Info, Users, ListChecks } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { useTest } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import { formatDateTime, versionLabel } from '@/lib/format';
import { QUESTION_TYPE_LABELS } from '@/lib/testQuestions';
import { TestStatusBadge } from '@/components/ui/TestStatusBadge';
import { AssignModal } from './AssignModal';
import { TestQuestionsModal } from './TestQuestionsModal';

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

export function TestCardModal({
  open,
  onClose,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  testId: number | null;
}) {
  const { data: test, isLoading, isError, error, refetch } = useTest(open ? testId : null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={test ? test.title : 'Карточка теста'}
        subtitle={test ? `${test.subjectName} · ${test.grade}` : undefined}
        footer={
          test ? (
            <>
              {test.status !== 'ACTIVE' && (
                <span className="mr-auto text-xs text-amber-600">
                  Черновик нельзя назначать — переведите тест в «Активен».
                </span>
              )}
              <Button variant="secondary" onClick={onClose}>
                Закрыть
              </Button>
              <Button
                variant="secondary"
                icon={<ListChecks className="h-4 w-4" />}
                onClick={() => setQuestionsOpen(true)}
              >
                Вопросы ({test.questionCount})
              </Button>
              <Button
                icon={<UserPlus className="h-4 w-4" />}
                disabled={test.status !== 'ACTIVE'}
                onClick={() => setAssignOpen(true)}
              >
                Назначить поступающих
              </Button>
            </>
          ) : undefined
        }
      >
        {isLoading ? (
          <LoadingBlock label="Загрузка теста…" />
        ) : isError || !test ? (
          <ErrorBlock message={error instanceof ApiError ? error.message : 'Не удалось загрузить тест'} onRetry={refetch} />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <TestStatusBadge status={test.status} />
              <Badge tone="blue">{versionLabel(test.currentVersionNumber, test.currentVersionCreatedAt)}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Metric icon={<Clock className="h-3.5 w-3.5" />} label="Длительность" value={`${test.durationMinutes} мин`} />
              <Metric icon={<Target className="h-3.5 w-3.5" />} label="Мин. балл" value={String(test.minScore)} />
              <Metric icon={<ListChecks className="h-3.5 w-3.5" />} label="Вопросов" value={String(test.questionCount)} />
              <Metric
                icon={<Percent className="h-3.5 w-3.5" />}
                label="Мин. процент"
                value={test.minPercent != null ? `${test.minPercent}%` : '—'}
              />
              <Metric icon={<Repeat className="h-3.5 w-3.5" />} label="Попыток" value={String(test.maxAttempts)} />
            </div>

            <div className="flex flex-wrap gap-2">
              {test.allowBackNavigation && <Badge tone="gray">Можно возвращаться назад</Badge>}
              {test.shuffleQuestions && <Badge tone="gray">Перемешивать вопросы</Badge>}
              {test.shuffleOptions && <Badge tone="gray">Перемешивать ответы</Badge>}
            </div>

            {test.rules && (
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Info className="h-3.5 w-3.5" /> Инструкция
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600">{test.rules}</p>
              </div>
            )}

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <ListChecks className="h-4 w-4 text-slate-400" /> Вопросы ({test.questionCount})
              </p>
              {(test.questions ?? []).length === 0 ? (
                <EmptyBlock
                  title="Вопросов пока нет"
                  description="Нажмите «Вопросы» внизу, чтобы добавить задания для поступающих."
                />
              ) : (
                <ul className="divide-y divide-slate-50 rounded-xl ring-1 ring-slate-200">
                  {(test.questions ?? []).map((q, index) => (
                    <li key={q.id} className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">
                        {index + 1}. {q.text}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {QUESTION_TYPE_LABELS[q.type]} · {q.maxScore} {q.maxScore === 1 ? 'балл' : 'балла'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Versions */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <History className="h-4 w-4 text-slate-400" /> Версии
              </p>
              <ul className="space-y-1.5">
                {test.versions.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-700">Версия {v.versionNumber}</span>
                    <span className="text-slate-400">{formatDateTime(v.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Assigned applicants */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Users className="h-4 w-4 text-slate-400" /> Назначенные поступающие ({test.assignments.length})
              </p>
              {test.assignments.length === 0 ? (
                <EmptyBlock title="Пока никого не назначено" description="Нажмите «Назначить поступающих»." />
              ) : (
                <ul className="divide-y divide-slate-50 rounded-xl ring-1 ring-slate-200">
                  {test.assignments.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Avatar name={a.applicantName} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{a.applicantName}</span>
                        <span className="block truncate text-xs text-slate-400">
                          {a.grade} · {a.accessCode ?? '—'} · Версия {a.versionNumber ?? '—'}
                        </span>
                      </span>
                      <span className="text-xs text-slate-400">{formatDateTime(a.assignedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {test && <AssignModal open={assignOpen} onClose={() => setAssignOpen(false)} test={test} />}
      {test && (
        <TestQuestionsModal
          open={questionsOpen}
          onClose={() => setQuestionsOpen(false)}
          testId={test.id}
        />
      )}
    </>
  );
}
