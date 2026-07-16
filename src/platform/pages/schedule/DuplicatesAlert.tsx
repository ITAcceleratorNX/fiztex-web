import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { DuplicateStudent, Subgroup } from '@/lib/schedule2bTypes';
import {
  formatDuplicateLocations,
  studentFullName,
} from './subgroupHelpers';

export function DuplicatesAlert({
  duplicates,
  subgroups,
  disabled,
  onKeepOnlyIn,
}: {
  duplicates: DuplicateStudent[];
  subgroups: Subgroup[];
  disabled?: boolean;
  onKeepOnlyIn: (studentId: number, keepSubgroupId: number, fromSubgroupIds: number[]) => void;
}) {
  if (duplicates.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" />
        Задвоенные ученики
      </div>
      <ul className="space-y-2">
        {duplicates.map((dup) => (
          <li
            key={dup.studentId}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>
              {studentFullName(dup)} — сейчас в: {formatDuplicateLocations(dup, subgroups)}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {dup.subgroupIds.map((keepId) => (
                <Button
                  key={keepId}
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  onClick={() =>
                    onKeepOnlyIn(
                      dup.studentId,
                      keepId,
                      dup.subgroupIds.filter((id) => id !== keepId),
                    )
                  }
                >
                  Оставить только в «
                  {subgroups.find((s) => s.id === keepId)?.name ?? `#${keepId}`}»
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
