import { AlertTriangle } from 'lucide-react';
import type { Subgroup, SubgroupStudent } from '@/lib/schedule2bTypes';
import { studentShortName, type Membership } from './subgroupHelpers';

/**
 * Ученик попал сразу в несколько подгрупп одного набора. В макетах такого
 * состояния нет — баннер собран из тех же токенов, что и полоса конфликта
 * в шаблонах звонков (2015:8885): красная подложка, иконка 14, текст 13.
 *
 * Правка делается в черновике и уезжает на сервер вместе с «Сохранить состав».
 */
export function DuplicatesAlert({
  duplicateIds,
  studentsById,
  membership,
  subgroups,
  disabled,
  onKeepOnlyIn,
}: {
  duplicateIds: number[];
  studentsById: Map<number, SubgroupStudent>;
  membership: Membership;
  subgroups: Subgroup[];
  disabled?: boolean;
  onKeepOnlyIn: (studentId: number, keepSubgroupId: number) => void;
}) {
  if (duplicateIds.length === 0) return null;

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl bg-red-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-3.5 shrink-0 text-red-600" />
        <p className="text-13 font-semibold text-red-600">Ученики в двух группах сразу</p>
      </div>

      <ul className="flex flex-col gap-2">
        {duplicateIds.map((studentId) => {
          const student = studentsById.get(studentId);
          const inGroups = subgroups.filter((sg) =>
            (membership[sg.id] ?? []).includes(studentId),
          );
          return (
            <li
              key={studentId}
              className="flex flex-wrap items-center justify-between gap-2 text-13 text-ink"
            >
              <span>
                {student ? studentShortName(student) : `Ученик #${studentId}`} — в{' '}
                {inGroups.map((sg) => `«${sg.name}»`).join(', ')}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {inGroups.map((sg) => (
                  <button
                    key={sg.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onKeepOnlyIn(studentId, sg.id)}
                    className="rounded-md border border-line bg-white px-2.5 py-1 text-11 font-semibold text-muted transition hover:text-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Оставить в «{sg.name}»
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
