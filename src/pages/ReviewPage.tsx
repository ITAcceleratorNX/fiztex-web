import { useMemo, useState } from 'react';
import { ClipboardCheck, AlertTriangle, Eye } from 'lucide-react';
import { useReviews } from '@/hooks/queries';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ReviewModal } from '@/pages/modals/ReviewModal';
import { formatDateTime, pluralRu, cx } from '@/lib/format';
import { ApiError } from '@/lib/api';
import type { AssignmentStatus, ReviewDetail } from '@/lib/types';

type Tab = 'PENDING' | 'REVIEWED' | 'ALL';

const isPending = (r: ReviewDetail) => r.attemptStatus === 'AWAITING_REVIEW';
const isReviewed = (r: ReviewDetail) =>
  r.attemptStatus === 'REVIEWED' || r.attemptStatus === 'OPEN_FOR_VIEWING';

function statusBadge(status: AssignmentStatus) {
  if (status === 'AWAITING_REVIEW') return <Badge tone="amber" dot>Ожидает проверки</Badge>;
  if (status === 'REVIEWED') return <Badge tone="blue" dot>Проверено</Badge>;
  if (status === 'OPEN_FOR_VIEWING') return <Badge tone="green" dot>Результат открыт</Badge>;
  return <Badge tone="gray">—</Badge>;
}

export function ReviewPage() {
  // Fetch everything once, then filter client-side so reviewed attempts stay reachable.
  const { data, isLoading, isError, error, refetch, isSuccess } = useReviews('ALL');
  const [tab, setTab] = useState<Tab>('PENDING');
  const [openAttempt, setOpenAttempt] = useState<number | null>(null);

  const all = data ?? [];
  const pending = useMemo(() => all.filter(isPending), [all]);
  const reviewed = useMemo(() => all.filter(isReviewed), [all]);
  const withFlags = useMemo(() => all.filter((r) => r.suspiciousLogs.length > 0).length, [all]);

  const shown = tab === 'PENDING' ? pending : tab === 'REVIEWED' ? reviewed : all;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'PENDING', label: 'Ожидают проверки', count: pending.length },
    { key: 'REVIEWED', label: 'Проверенные', count: reviewed.length },
    { key: 'ALL', label: 'Все', count: all.length },
  ];

  return (
    <div>
      <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
        Проверка ответов
      </h1>
      <p className="mt-1 text-slate-500">
        Попытки, отправленные на проверку школы. Проверенные остаются здесь — их можно открыть в
        режиме просмотра.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Ожидают проверки" value={isSuccess ? pending.length : '—'} />
        <StatCard label="Проверено" value={isSuccess ? reviewed.length : '—'} />
        <StatCard label="С событиями" value={isSuccess ? withFlags : '—'} />
      </div>

      {/* Filter tabs */}
      <div className="mt-6 inline-flex rounded-xl bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              'rounded-lg px-3.5 py-1.5 text-sm font-medium transition',
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-slate-400">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 card overflow-hidden">
        {isLoading ? (
          <LoadingBlock label="Загрузка попыток…" />
        ) : isError ? (
          <ErrorBlock message={error instanceof ApiError ? error.message : 'Ошибка загрузки'} onRetry={refetch} />
        ) : shown.length === 0 ? (
          <EmptyBlock
            icon={<ClipboardCheck className="h-7 w-7" />}
            title={tab === 'PENDING' ? 'Нет попыток на проверке' : 'Пусто'}
            description={
              tab === 'PENDING'
                ? 'Как только поступающий завершит тест, попытка появится здесь.'
                : 'В этой вкладке пока нет попыток.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3.5">Поступающий</th>
                  <th className="px-6 py-3.5">Тест</th>
                  <th className="px-6 py-3.5">Завершён</th>
                  <th className="px-6 py-3.5">Вкладки</th>
                  <th className="px-6 py-3.5">События</th>
                  <th className="px-6 py-3.5">Статус</th>
                  <th className="px-6 py-3.5 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {shown.map((r) => (
                  <tr key={r.attemptId} className="transition hover:bg-slate-50/70">
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{r.applicantName}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{r.testTitle}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-500">{formatDateTime(r.finishedAt)}</td>
                    <td className="px-6 py-3.5">
                      {(r.tabSwitchCount ?? 0) > 0 ? (
                        <Badge tone="amber" dot>
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {r.tabSwitchCount}{' '}
                          {pluralRu(r.tabSwitchCount, ['раз', 'раза', 'раз'])}
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {r.suspiciousLogs.length > 0 ? (
                        <Badge tone="amber" dot>
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {r.suspiciousLogs.length}{' '}
                          {pluralRu(r.suspiciousLogs.length, ['событие', 'события', 'событий'])}
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">{statusBadge(r.attemptStatus)}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant={isPending(r) ? 'primary' : 'secondary'}
                          icon={<Eye className="h-4 w-4" />}
                          onClick={() => setOpenAttempt(r.attemptId)}
                        >
                          {isPending(r) ? 'Проверить' : 'Посмотреть'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isSuccess && shown.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-3 text-sm text-slate-400">
            {shown.length} {pluralRu(shown.length, ['попытка', 'попытки', 'попыток'])}
          </div>
        )}
      </div>

      <ReviewModal
        open={openAttempt != null}
        attemptId={openAttempt}
        onClose={() => setOpenAttempt(null)}
      />
    </div>
  );
}
