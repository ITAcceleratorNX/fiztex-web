import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ClipboardList,
  Clock,
  Copy,
  Eye,
  LogIn,
  MonitorOff,
  Pencil,
  ScrollText,
  WifiOff,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useMonitoringAttempts } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { ReviewModal } from '@/pages/modals/ReviewModal';
import { AttemptLogsModal } from '@/pages/modals/AttemptLogsModal';
import { isFinalAttemptStatus } from '@/lib/admissionStatus';
import { formatDateTime } from '@/lib/format';
import type { Applicant, AssignmentStatus, MonitoringAttemptItem } from '@/lib/types';

/** How many monitoring pages to pull while hunting for this applicant's attempts. */
const MAX_MONITORING_PAGES = 6;

function statusBadge(status: AssignmentStatus | 'NOT_STARTED', retakeAllowed = false) {
  if (retakeAllowed) return <Badge tone="purple" dot>Повтор разрешён</Badge>;
  switch (status) {
    case 'ASSIGNED':
      return <Badge tone="gray" dot>Назначен</Badge>;
    case 'NOT_STARTED':
      return <Badge tone="gray" dot>Не начат</Badge>;
    case 'IN_PROGRESS':
      return <Badge tone="blue" dot>В процессе</Badge>;
    case 'COMPLETED':
      return <Badge tone="green" dot>Завершён</Badge>;
    case 'AWAITING_REVIEW':
      return <Badge tone="amber" dot>Ожидает проверки</Badge>;
    case 'REVIEWED':
      return <Badge tone="green" dot>Проверено</Badge>;
    case 'OPEN_FOR_VIEWING':
      return <Badge tone="green" dot>Результат открыт</Badge>;
    default:
      return <Badge tone="gray">{status}</Badge>;
  }
}

function EventFlags({ row }: { row: MonitoringAttemptItem }) {
  const flags = [
    { on: row.focusLost, icon: MonitorOff, label: 'Выход из окна' },
    { on: row.reentry, icon: LogIn, label: 'Повторный вход' },
    { on: row.timeExpired, icon: Clock, label: 'Истекло время' },
    { on: row.connectionIssue, icon: WifiOff, label: 'Проблема с сохранением' },
  ].filter((f) => f.on);

  if (flags.length === 0) return <span className="text-sm text-slate-300">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {flags.map(({ icon: Icon, label }) => (
        <span
          key={label}
          title={label}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-200"
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">{label}</span>
        </span>
      ))}
    </div>
  );
}

function HeaderCode({ code }: { code: string | null }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code as string);
      setCopied(true);
      toast.success('Код скопирован');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Не удалось скопировать код');
    }
  }

  return (
    <button
      onClick={() => void copy()}
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-medium text-slate-700 transition hover:bg-slate-200"
      title="Скопировать код"
    >
      {code}
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
    </button>
  );
}

export function ApplicantDetailModal({
  open,
  applicant,
  onClose,
  onEdit,
}: {
  open: boolean;
  applicant: Applicant | null;
  onClose: () => void;
  onEdit: (applicant: Applicant) => void;
}) {
  const attemptsQuery = useMonitoringAttempts('ALL');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = attemptsQuery;

  const [reviewAttemptId, setReviewAttemptId] = useState<number | null>(null);
  const [logsAttempt, setLogsAttempt] = useState<MonitoringAttemptItem | null>(null);

  const byAssignment = useMemo(() => {
    const map = new Map<number, MonitoringAttemptItem>();
    for (const page of data?.pages ?? []) {
      for (const row of page.content) map.set(row.assignmentId, row);
    }
    return map;
  }, [data]);

  const assignments = applicant?.assignments ?? [];
  const pagesLoaded = data?.pages.length ?? 0;
  const allMatched = assignments.every((a) => byAssignment.has(a.id));

  // Pull further monitoring pages until this applicant's rows are found (bounded).
  useEffect(() => {
    if (!open || assignments.length === 0) return;
    if (hasNextPage && !isFetchingNextPage && !allMatched && pagesLoaded < MAX_MONITORING_PAGES) {
      void fetchNextPage();
    }
  }, [open, assignments.length, hasNextPage, isFetchingNextPage, allMatched, pagesLoaded, fetchNextPage]);

  if (!applicant) return null;

  const loadingAttempts = isLoading || (!allMatched && isFetchingNextPage);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="xl"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={applicant.childFullName} />
            <span>{applicant.childFullName}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{applicant.grade}</span>
            {applicant.accessCode && (
              <>
                <span className="text-slate-300">·</span>
                <HeaderCode code={applicant.accessCode} />
              </>
            )}
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Закрыть
            </Button>
            <Button icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(applicant)}>
              Редактировать
            </Button>
          </>
        }
      >
        {/* Contact info */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">ФИО родителя</p>
            <p className="mt-1 text-sm text-slate-700">{applicant.parentFullName || '—'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Телефон</p>
            <p className="mt-1 text-sm text-slate-700">{applicant.parentPhone || '—'}</p>
          </div>
        </div>

        {applicant.comment && (
          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Комментарий</p>
            <p className="mt-1 text-sm text-slate-700">{applicant.comment}</p>
          </div>
        )}

        {/* Assignments & attempts */}
        <div className="mt-6 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            Назначенные тесты и попытки
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
              {assignments.length}
            </span>
          </h3>
          {loadingAttempts && <span className="text-xs text-slate-400">Загрузка попыток…</span>}
        </div>

        {assignments.length === 0 ? (
          <div className="mt-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
            <ClipboardList className="h-7 w-7 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-600">Тесты ещё не назначены</p>
            <p className="mt-1 text-xs text-slate-400">
              Назначьте тест этому поступающему в карточке теста.
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-slate-200/70">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Тест</th>
                  <th className="px-4 py-3">Версия</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Прогресс</th>
                  <th className="px-4 py-3">События</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {assignments.map((a) => {
                  const mon = byAssignment.get(a.id);
                  const status = mon?.status ?? a.status;
                  const finished = mon?.attemptId != null && isFinalAttemptStatus(mon.status);
                  return (
                    <tr key={a.id} className="transition hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{a.testTitle}</p>
                        <p className="text-xs text-slate-400">{formatDateTime(a.assignedAt)}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {a.versionNumber != null ? `v${a.versionNumber}` : '—'}
                      </td>
                      <td className="px-4 py-3">{statusBadge(status, mon?.retakeAllowed ?? false)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {mon && mon.questionCount > 0 ? `${mon.answeredCount}/${mon.questionCount}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {mon ? <EventFlags row={mon} /> : <span className="text-sm text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {finished && mon?.attemptId != null && (
                            <Button
                              size="sm"
                              variant={mon.status === 'AWAITING_REVIEW' ? 'primary' : 'secondary'}
                              icon={<Eye className="h-4 w-4" />}
                              onClick={() => setReviewAttemptId(mon.attemptId)}
                            >
                              {mon.status === 'AWAITING_REVIEW' ? 'Проверить' : 'Посмотреть'}
                            </Button>
                          )}
                          {mon?.attemptId != null ? (
                            <button
                              onClick={() => setLogsAttempt(mon)}
                              title="События и повтор"
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            >
                              <ScrollText className="h-4 w-4" />
                              <span className="sr-only">События и повтор</span>
                            </button>
                          ) : (
                            <span className="text-sm text-slate-300">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <AttemptLogsModal
        open={logsAttempt != null}
        attempt={logsAttempt}
        onClose={() => setLogsAttempt(null)}
      />

      <ReviewModal
        open={reviewAttemptId != null}
        attemptId={reviewAttemptId}
        onClose={() => setReviewAttemptId(null)}
      />
    </>
  );
}
