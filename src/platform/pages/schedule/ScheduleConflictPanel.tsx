import { WEEKDAY_LABELS } from '@/platform/labels';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import type { ConflictCheckReport, ConflictFinding } from '@/platform/services/schedules';

function FindingRow({ finding, tone }: { finding: ConflictFinding; tone: 'critical' | 'warning' }) {
  const day =
    finding.weekday != null
      ? WEEKDAY_LABELS[finding.weekday as Weekday] ?? finding.weekday
      : null;
  const slot =
    day || finding.lessonNumber != null
      ? [day, finding.lessonNumber != null ? `урок ${finding.lessonNumber}` : null]
          .filter(Boolean)
          .join(' · ')
      : null;

  return (
    <li
      className={`rounded-lg border px-3 py-2 text-sm ${
        tone === 'critical'
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      <div className="font-medium">{finding.code}</div>
      <div className="mt-0.5">{finding.message}</div>
      {slot && <div className="mt-1 text-xs opacity-80">{slot}</div>}
      {finding.suggestedAction && (
        <div className="mt-1 text-xs opacity-70">{finding.suggestedAction}</div>
      )}
    </li>
  );
}

export function ScheduleConflictPanel({
  report,
  onClear,
}: {
  report: ConflictCheckReport | null;
  onClear?: () => void;
}) {
  if (!report) return null;

  const { criticals, warnings, summary } = report;
  const empty = criticals.length === 0 && warnings.length === 0;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Проверка конфликтов
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {empty
              ? 'Критических ошибок и предупреждений нет'
              : `Критических: ${summary.criticalCount}, предупреждений: ${summary.warningCount}`}
          </p>
          <p className="text-xs text-slate-400">revision {report.draftRevision}</p>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-slate-500 underline hover:text-slate-700"
          >
            Скрыть
          </button>
        )}
      </div>
      {criticals.length > 0 && (
        <ul className="space-y-2">
          {criticals.map((f, i) => (
            <FindingRow key={`c-${f.code}-${f.lessonId ?? i}`} finding={f} tone="critical" />
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="space-y-2">
          {warnings.map((f, i) => (
            <FindingRow key={`w-${f.code}-${f.lessonId ?? i}`} finding={f} tone="warning" />
          ))}
        </ul>
      )}
    </div>
  );
}
