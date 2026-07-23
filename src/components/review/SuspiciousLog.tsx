import { ShieldAlert, CircleDot } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/format';
import type { SuspiciousLogItem } from '@/lib/types';
import { EVENT_LABEL } from './constants';

export function SuspiciousLog({
  logs,
  violationCount,
}: {
  logs: SuspiciousLogItem[];
  violationCount: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold text-slate-700">
          Античит-события ({logs.length})
        </span>
        {violationCount > 0 && (
          <Badge tone="amber" dot>
            Нарушений: {violationCount}
          </Badge>
        )}
      </div>
      {logs.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">Событий не зафиксировано.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {logs.map((log, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
              <CircleDot className="h-3.5 w-3.5 shrink-0 text-slate-300" />
              <span className="font-medium text-slate-700">
                {EVENT_LABEL[log.type] ?? log.type}
              </span>
              <span className="text-slate-400">· {formatDateTime(log.occurredAt)}</span>
              {log.questionOrder != null && (
                <span className="text-slate-400">· Вопрос {log.questionOrder}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-400">
        События информационные. Автопровала нет — итоговое решение принимает школа.
      </p>
    </div>
  );
}
