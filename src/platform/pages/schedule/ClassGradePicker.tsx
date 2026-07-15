import { useEffect, useRef, type ReactNode } from 'react';
import type { GradeClassGroup } from '@/lib/scheduleSettingsTypes';
import { cx } from '@/lib/format';

/**
 * Shared «параллель → классы» tree (bindings + calendar CLASSES scope).
 * Occupancy / unassign chrome are optional slots — not copied per screen.
 */
export function ClassGradePicker({
  gradeGroups,
  selectedClassIds,
  onToggleClass,
  onToggleGrade,
  classMeta,
  classTrailing,
  disabled,
  className,
}: {
  gradeGroups: GradeClassGroup[];
  selectedClassIds: Set<number>;
  onToggleClass: (classId: number) => void;
  onToggleGrade: (classIds: number[]) => void;
  classMeta?: (classId: number) => ReactNode;
  classTrailing?: (classId: number) => ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('max-h-[28rem] space-y-4 overflow-y-auto', className)}>
      {gradeGroups.map((group) => {
        const ids = group.classes.map((c) => c.id);
        const selectedCount = ids.filter((id) => selectedClassIds.has(id)).length;
        const allOn = selectedCount === ids.length && ids.length > 0;
        const someOn = selectedCount > 0 && !allOn;

        return (
          <div key={group.grade} className="rounded-xl border border-slate-100 p-3">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <IndeterminateCheckbox
                checked={allOn}
                indeterminate={someOn}
                disabled={disabled}
                onChange={() => onToggleGrade(ids)}
              />
              Параллель {group.grade}
              <span className="font-normal text-slate-400">
                ({selectedCount}/{ids.length})
              </span>
            </label>
            <ul className="space-y-1.5 pl-6">
              {group.classes.map((schoolClass) => (
                <li
                  key={schoolClass.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={selectedClassIds.has(schoolClass.id)}
                      disabled={disabled}
                      onChange={() => onToggleClass(schoolClass.id)}
                    />
                    <span className="font-medium text-slate-800">{schoolClass.name}</span>
                    {classMeta?.(schoolClass.id)}
                  </label>
                  {classTrailing?.(schoolClass.id)}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="rounded border-slate-300"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
    />
  );
}
