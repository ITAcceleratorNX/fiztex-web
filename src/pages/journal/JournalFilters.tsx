import { Eye } from 'lucide-react';
import { Select, SelectGroup } from '@/components/ui/Select';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import type { GradebookPeriodRef, GradebookScope, GradebookSubgroup } from '@/lib/gradebookApi';
import type { MonthOption } from '@/lib/journalModel';
import { shortDate } from '@/lib/journalModel';
import { withDemoMark } from '@/lib/demoClass';
import { extendedUntilLabel } from '@/lib/studyAccessModel';

export type JournalWindow = 'MONTH' | 'PERIOD';

/**
 * Шапка фильтров журнала (Figma 2098:441).
 *
 * <p>Класс и подгруппа — <b>один</b> фильтр, как в макете: подгруппа не существует сама по
 * себе, а без класса не выбирается. Список подгрупп приходит вместе с журналом
 * (`availableSubgroups`) — он же знает, идёт предмет всем классом или по подгруппам.
 *
 * <p>Классы, открытые администратором только для просмотра (STUDY-ACCESS, Figma `phyztex` У3),
 * идут отдельной группой «Только просмотр» со сроком; свои — группой «Мои классы». Пока
 * дополнительных нет, групп нет вовсе — список выглядит как раньше. Класс, доступ к которому
 * закончился (`lockedClass`), остаётся в списке выбранным, чтобы «нет доступа» под фильтром
 * относилось к нему, а не к пустому полю.
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
  showPeriod = true,
  onChangeClass,
  onChangeSubgroup,
  onChangeSubject,
  onChangePeriod,
  onChangeMonth,
  onChangeWindow,
  lockedClass,
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
  showPeriod?: boolean;
  onChangeClass: (classId: number) => void;
  onChangeSubgroup: (subgroupId: number | null) => void;
  onChangeSubject: (subjectId: number) => void;
  onChangePeriod: (periodId: number) => void;
  onChangeMonth: (key: string) => void;
  onChangeWindow: (window: JournalWindow) => void;
  lockedClass?: { id: number; name: string } | null;
}) {
  const classes = uniqueClasses(scopes);
  const own = classes.filter((item) => !item.extended);
  const extended = classes.filter((item) => item.extended);
  const grouped = extended.length > 0 || lockedClass != null;
  const classOption = (item: (typeof classes)[number]) => (
    <option key={item.id} value={`class:${item.id}`} data-hint={item.extended ? extendedUntilLabel(item.until) : undefined}>
      {withDemoMark(item.name, item.demo)}
    </option>
  );
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
          {grouped ? [
            own.length > 0 && <SelectGroup key="own" label="Мои классы">{own.map(classOption)}</SelectGroup>,
            <SelectGroup key="extended" label="Только просмотр" icon={<Eye className="size-4 text-navy-700" aria-hidden />}>
              {extended.map(classOption)}
              {lockedClass && <option value={`class:${lockedClass.id}`}>{lockedClass.name}</option>}
            </SelectGroup>,
          ] : classes.map(classOption)}
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

      {showPeriod && <Filter label="Период" className="w-[226px]">
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
      </Filter>}

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

/**
 * Классы из областей журнала. Класс «дополнительный», только если **все** его предметы
 * открыты просмотром: свой предмет в том же классе делает класс своим, и он не уходит в группу
 * «Только просмотр» (ТЗ §5 — свои редактируемые данные не становятся read-only).
 */
function uniqueClasses(scopes: GradebookScope[]): Array<{ id: number; name: string; demo: boolean; extended: boolean; until: string | null }> {
  const map = new Map<number, { name: string; demo: boolean; extended: boolean; until: string | null }>();
  for (const scope of scopes) {
    if (scope.classId == null) continue;
    const known = map.get(scope.classId);
    const extended = Boolean(scope.extended) && (known?.extended ?? true);
    map.set(scope.classId, {
      name: scope.className ?? '',
      demo: Boolean(scope.classDemo),
      extended,
      until: extended ? scope.extendedUntil ?? known?.until ?? null : null,
    });
  }
  return [...map].map(([id, item]) => ({ id, ...item }));
}
