import { cx } from '@/lib/format';
import { WEEKDAY_LABELS } from '@/platform/labels';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import type {
  ConflictCheckReport,
  ConflictFinding,
  LessonPeriodSlot,
} from '@/platform/services/schedules';

/**
 * Результат проверки расписания. Figma 2015:5371 — каждая находка отдельным
 * баннером: 2015:5448 (критичный, рамка #ef4444) и 2015:5454 (предупреждение,
 * рамка #fb923c). Сводки над списком в макете нет.
 */
export function ScheduleConflictPanel({
  report,
  periods = [],
  className,
  onGoToSlot,
}: {
  report: ConflictCheckReport | null;
  periods?: LessonPeriodSlot[];
  /** Название класса для заголовка баннера, например «8А». */
  className?: string;
  onGoToSlot?: (finding: ConflictFinding) => void;
}) {
  if (!report) return null;

  const { criticals, warnings } = report;
  if (criticals.length === 0 && warnings.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {criticals.map((f, i) => (
        <FindingBanner
          key={`c-${f.code}-${f.lessonId ?? i}`}
          finding={f}
          tone="critical"
          periods={periods}
          className={className}
          onGoToSlot={onGoToSlot}
        />
      ))}
      {warnings.map((f, i) => (
        <FindingBanner
          key={`w-${f.code}-${f.lessonId ?? i}`}
          finding={f}
          tone="warning"
          periods={periods}
          className={className}
          onGoToSlot={onGoToSlot}
        />
      ))}
    </div>
  );
}

function FindingBanner({
  finding,
  tone,
  periods,
  className,
  onGoToSlot,
}: {
  finding: ConflictFinding;
  tone: 'critical' | 'warning';
  periods: LessonPeriodSlot[];
  className?: string;
  onGoToSlot?: (finding: ConflictFinding) => void;
}) {
  return (
    <div
      className={cx(
        'flex items-center gap-2.5 rounded-lg border px-4 py-2.5',
        tone === 'critical' ? 'border-red-500 bg-danger-bg' : 'border-brand-500 bg-warning-bg',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-sm font-bold text-ink">{slotTitle(finding, periods, className)}</p>
        <p className="text-13 text-muted">{finding.message}</p>
      </div>

      {onGoToSlot && finding.weekday && finding.lessonNumber != null && (
        <button
          type="button"
          onClick={() => onGoToSlot(finding)}
          className="shrink-0 whitespace-nowrap pl-4 text-13 font-semibold text-navy-700 transition hover:text-navy-800"
        >
          Перейти к слоту →
        </button>
      )}
    </div>
  );
}

/** «Понедельник, урок 3 (09:50–10:35) · 8А» — 2015:5450. */
function slotTitle(
  finding: ConflictFinding,
  periods: LessonPeriodSlot[],
  className?: string,
): string {
  const day = finding.weekday
    ? (WEEKDAY_LABELS[finding.weekday as Weekday] ?? finding.weekday)
    : null;
  const period = periods.find((p) => p.lessonNumber === finding.lessonNumber);
  const time = period ? `(${period.startTime.slice(0, 5)}–${period.endTime.slice(0, 5)})` : null;
  const lesson =
    finding.lessonNumber != null ? `урок ${finding.lessonNumber}${time ? ` ${time}` : ''}` : null;

  const left = [day, lesson].filter(Boolean).join(', ');
  return [left || finding.code, className].filter(Boolean).join(' · ');
}
