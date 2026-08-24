import { Select } from '@/components/ui/Select';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import type { GradebookPeriodRef, GradebookScope, GradebookSubgroup } from '@/lib/gradebookApi';
import type { MonthOption } from '@/lib/journalModel';
import { shortDate } from '@/lib/journalModel';

export type JournalWindow = 'MONTH' | 'PERIOD';

/**
 * Шапка фильтров журнала (Figma 2098:441).
 *
 * <p>Класс и подгруппа — <b>один</b> фильтр, как в макете: подгруппа не существует сама по
 * себе, а без класса не выбирается. Список подгрупп приходит вместе с журналом
 * (`availableSubgroups`) — он же знает, идёт предмет всем классом или по подгруппам.
 *
 * <p>«Месяц» — не отдельный период, а окно внутри четверти (gradebook-read-contract §2),
 * поэтому в режиме месяца тот же фильтр «Период» показывает месяцы: выбор месяца задаёт
 * журналу и четверть, и границы дат разом.
 */
export function JournalFilters({
  scopes,
  periods,
  months,
  subgroups,
  classId,
  subjectId,
  subgroupId,
  periodId,
  monthKey,
  window,
  showWindowToggle,
  onChangeClass,
  onChangeSubgroup,
  onChangeSubject,
  onChangePeriod,
  onChangeMonth,
  onChangeWindow,
}: {
  scopes: GradebookScope[];
  periods: GradebookPeriodRef[];
  months: MonthOption[];
  subgroups: GradebookSubgroup[];
  classId: number | null;
  subjectId: number | null;
  subgroupId: number | null;
  periodId: number | null;
  monthKey: string | null;
  window: JournalWindow;
  showWindowToggle: boolean;
  onChangeClass: (classId: number) => void;
  onChangeSubgroup: (subgroupId: number | null) => void;
  onChangeSubject: (subjectId: number) => void;
  onChangePeriod: (periodId: number) => void;
  onChangeMonth: (key: string) => void;
  onChangeWindow: (window: JournalWindow) => void;
}) {
  const classes = uniqueClasses(scopes);
  const subjects = scopes.filter((scope) => scope.classId === classId);
  const className = classes.find((item) => item.id === classId)?.name ?? '';

  return (
    <div className="flex flex-wrap items-end gap-6">
      <Filter label="Класс / подгруппа" className="w-[227px]">
        <Select
          value={subgroupId != null ? `sub:${subgroupId}` : `class:${classId ?? ''}`}
          onChange={(event) => {
            const [kind, value] = event.target.value.split(':');
            if (kind === 'sub') onChangeSubgroup(Number(value));
            else {
              onChangeSubgroup(null);
              onChangeClass(Number(value));
            }
          }}
        >
          {classes.map((item) => (
            <option key={item.id} value={`class:${item.id}`}>
              {item.name}
            </option>
          ))}
          {subgroups.map((subgroup) => (
            <option key={subgroup.id} value={`sub:${subgroup.id}`}>
              {`${className} · ${subgroup.name}`}
            </option>
          ))}
        </Select>
      </Filter>

      <Filter label="Предмет" className="w-[171px]">
        <Select
          value={String(subjectId ?? '')}
          onChange={(event) => onChangeSubject(Number(event.target.value))}
        >
          {subjects.map((scope) => (
            <option key={scope.subjectId} value={String(scope.subjectId)}>
              {scope.subjectName}
            </option>
          ))}
        </Select>
      </Filter>

      <Filter label="Период" className="w-[226px]">
        {window === 'MONTH' ? (
          <Select value={monthKey ?? ''} onChange={(event) => onChangeMonth(event.target.value)}>
            {months.map((month) => (
              <option key={month.key} value={month.key}>
                {month.label}
              </option>
            ))}
          </Select>
        ) : (
          <Select
            value={String(periodId ?? '')}
            onChange={(event) => onChangePeriod(Number(event.target.value))}
          >
            {periods.map((period) => (
              <option key={period.id} value={String(period.id)}>
                {periodLabel(period)}
              </option>
            ))}
          </Select>
        )}
      </Filter>

      {showWindowToggle && (
        <SegmentedTabs
          value={window}
          options={[
            { value: 'MONTH', label: 'Месяц' },
            { value: 'PERIOD', label: 'Четверть' },
          ]}
          onChange={onChangeWindow}
          ariaLabel="Окно журнала"
        />
      )}
    </div>
  );
}

function Filter({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-2 block text-11 font-bold uppercase text-slate-400">{label}</span>
      {children}
    </label>
  );
}

/** «1 четверть (01.09 – 27.10)» — границы в подписи, как в макете. */
function periodLabel(period: GradebookPeriodRef): string {
  const range =
    period.startDate && period.endDate
      ? ` (${shortDate(period.startDate)} – ${shortDate(period.endDate)})`
      : '';
  return `${period.name ?? ''}${range}`;
}

function uniqueClasses(scopes: GradebookScope[]): Array<{ id: number; name: string }> {
  const map = new Map<number, string>();
  for (const scope of scopes) {
    if (scope.classId != null) map.set(scope.classId, scope.className ?? '');
  }
  return [...map].map(([id, name]) => ({ id, name }));
}
