import { useState } from 'react';
import { ClipboardCheck, AlertTriangle, Eye } from 'lucide-react';
import { useReviews } from '@/hooks/queries';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/ui/StateBlock';
import { ReviewModal } from '@/pages/modals/ReviewModal';
import { formatDateTime, pluralRu } from '@/lib/format';
import { ApiError } from '@/lib/api';

export function ReviewPage() {
  const { data, isLoading, isError, error, refetch, isSuccess } = useReviews();
  const [openAttempt, setOpenAttempt] = useState<number | null>(null);

  const withFlags = (data ?? []).filter((r) => r.suspiciousLogs.length > 0).length;

  return (
    <div>
      <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
        Проверка ответов
      </h1>
      <p className="mt-1 text-slate-500">
        Попытки, отправленные на проверку школы. Выставите баллы и подтвердите результат.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Ожидают проверки" value={data?.length ?? '—'} />
        <StatCard label="С событиями" value={isSuccess ? withFlags : '—'} />
        <StatCard label="Проверено сегодня" value="—" />
      </div>

      <div className="mt-6 card overflow-hidden">
        {isLoading ? (
          <LoadingBlock label="Загрузка попыток…" />
        ) : isError ? (
          <ErrorBlock message={error instanceof ApiError ? error.message : 'Ошибка загрузки'} onRetry={refetch} />
        ) : (data ?? []).length === 0 ? (
          <EmptyBlock
            icon={<ClipboardCheck className="h-7 w-7" />}
            title="Нет попыток на проверке"
            description="Как только поступающий завершит тест, попытка появится здесь."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3.5">Поступающий</th>
                  <th className="px-6 py-3.5">Тест</th>
                  <th className="px-6 py-3.5">Завершён</th>
                  <th className="px-6 py-3.5">События</th>
                  <th className="px-6 py-3.5 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data ?? []).map((r) => (
                  <tr key={r.attemptId} className="transition hover:bg-slate-50/70">
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{r.applicantName}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{r.testTitle}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-500">{formatDateTime(r.finishedAt)}</td>
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
                    <td className="px-6 py-3.5">
                      <div className="flex justify-end">
                        <Button size="sm" icon={<Eye className="h-4 w-4" />} onClick={() => setOpenAttempt(r.attemptId)}>
                          Проверить
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isSuccess && (data ?? []).length > 0 && (
          <div className="border-t border-slate-100 px-6 py-3 text-sm text-slate-400">
            {data!.length} {pluralRu(data!.length, ['попытка', 'попытки', 'попыток'])} на проверке
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
