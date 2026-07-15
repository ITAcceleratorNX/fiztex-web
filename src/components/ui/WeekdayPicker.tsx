import type { Weekday } from '@/lib/scheduleSettingsTypes';
import { WEEKDAY_SHORT_LABELS, WEEKDAYS_ORDER } from '@/platform/labels';
import { cx } from '@/lib/format';

export function WeekdayPicker({
  value,
  onChange,
  disabled,
}: {
  value: Weekday[];
  onChange: (next: Weekday[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(value);

  function toggle(day: Weekday) {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange(WEEKDAYS_ORDER.filter((d) => next.has(d)));
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Учебные дни недели">
      {WEEKDAYS_ORDER.map((day) => {
        const on = selected.has(day);
        return (
          <button
            key={day}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => toggle(day)}
            className={cx(
              'min-w-[3.25rem] rounded-xl px-3 py-3 text-sm font-semibold transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50',
              'disabled:cursor-not-allowed disabled:opacity-50',
              on
                ? 'bg-brand-500 text-white shadow-sm hover:bg-brand-600'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
            )}
          >
            {WEEKDAY_SHORT_LABELS[day]}
          </button>
        );
      })}
    </div>
  );
}
