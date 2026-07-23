import type { Weekday } from '@/lib/scheduleSettingsTypes';
import { WEEKDAY_LABELS } from '@/platform/labels';
import type {
  ConflictFinding,
  ScheduleGridView,
  ScheduleLesson,
} from '@/platform/services/schedules';
import { cx } from '@/lib/format';

function lessonsInSlot(
  lessons: ScheduleLesson[],
  weekday: Weekday,
  lessonNumber: number,
): ScheduleLesson[] {
  return lessons.filter((l) => l.weekday === weekday && l.lessonNumber === lessonNumber);
}

function shortTeacherName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  const [last, first, middle] = parts;
  const initials = [first, middle]
    .filter(Boolean)
    .map((p) => `${p[0]}.`)
    .join('');
  return `${last} ${initials}`.trim();
}

export function ScheduleWeeklyGrid({
  grid,
  readOnly,
  criticals = [],
  warnings = [],
  onAddSlot,
  onEditLesson,
}: {
  grid: ScheduleGridView;
  readOnly?: boolean;
  criticals?: ConflictFinding[];
  warnings?: ConflictFinding[];
  onAddSlot: (weekday: Weekday, periodId: number, lessonNumber: number) => void;
  onEditLesson: (lesson: ScheduleLesson) => void;
}) {
  const weekdays =
    grid.weekdays.length > 0
      ? grid.weekdays
      : (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as Weekday[]);
  const periods = [...grid.periods].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.lessonNumber - b.lessonNumber,
  );

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 z-10 w-24 bg-slate-50 px-3 py-3 text-left">
                № урока
              </th>
              {weekdays.map((day) => (
                <th key={day} className="px-2 py-3 text-center font-semibold normal-case tracking-normal text-slate-600">
                  {WEEKDAY_LABELS[day] ?? day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 && (
              <tr>
                <td
                  colSpan={weekdays.length + 1}
                  className="px-3 py-16 text-center text-slate-400"
                >
                  Нет слотов звонков — назначьте шаблон классу
                </td>
              </tr>
            )}
            {periods.map((period) => (
              <tr key={period.id} className="border-t border-slate-100">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 align-top">
                  <div className="text-lg font-bold leading-none text-navy-900">
                    {period.lessonNumber}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {period.startTime.slice(0, 5)}–{period.endTime.slice(0, 5)}
                  </div>
                </td>
                {weekdays.map((day) => {
                  const cellLessons = lessonsInSlot(grid.lessons, day, period.lessonNumber);
                  const hasCritical = criticals.some(
                    (f) => f.weekday === day && f.lessonNumber === period.lessonNumber,
                  );
                  const hasWarning =
                    !hasCritical &&
                    warnings.some(
                      (f) => f.weekday === day && f.lessonNumber === period.lessonNumber,
                    );
                  const isSubgroup = cellLessons.some((l) => l.targetType === 'SUBGROUP');

                  return (
                    <td key={`${day}-${period.id}`} className="p-1.5 align-top">
                      {cellLessons.length === 0 ? (
                        readOnly ? (
                          <div className="min-h-[4.75rem] rounded-xl border border-dashed border-slate-200 bg-slate-50/40" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAddSlot(day, period.id, period.lessonNumber)}
                            className="flex min-h-[4.75rem] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs text-slate-400 transition hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-600"
                          >
                            +
                          </button>
                        )
                      ) : (
                        <div
                          className={cx(
                            'flex min-h-[4.75rem] gap-1 rounded-xl border p-1',
                            hasCritical && 'border-red-300 bg-red-50/70',
                            hasWarning && !hasCritical && 'border-amber-300 bg-amber-50/60',
                            !hasCritical &&
                              !hasWarning &&
                              isSubgroup &&
                              'border-blue-200 bg-blue-50/50',
                            !hasCritical &&
                              !hasWarning &&
                              !isSubgroup &&
                              'border-slate-200 bg-white',
                          )}
                        >
                          {cellLessons.map((lesson) => (
                            <button
                              key={lesson.id}
                              type="button"
                              disabled={readOnly}
                              onClick={() => onEditLesson(lesson)}
                              className={cx(
                                'flex min-w-0 flex-1 flex-col rounded-lg px-2 py-1.5 text-left transition',
                                readOnly
                                  ? 'cursor-default'
                                  : 'hover:bg-white/80',
                                cellLessons.length > 1 && 'bg-white/70 ring-1 ring-blue-100',
                              )}
                            >
                              <div className="truncate text-[12px] font-semibold text-navy-900">
                                {lesson.subjectName}
                              </div>
                              <div className="mt-0.5 truncate text-[11px] text-slate-600">
                                {shortTeacherName(lesson.teacherFullName)}
                              </div>
                              {lesson.targetType === 'SUBGROUP' && lesson.subgroupName && (
                                <span className="mt-1 inline-flex w-fit rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-navy-700">
                                  {lesson.subgroupName}
                                </span>
                              )}
                              {lesson.room ? (
                                <div className="mt-0.5 text-[10px] text-slate-400">
                                  Каб. {lesson.room}
                                </div>
                              ) : null}
                            </button>
                          ))}
                          {!readOnly && isSubgroup && (
                            <button
                              type="button"
                              onClick={() => onAddSlot(day, period.id, period.lessonNumber)}
                              className="flex w-6 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white hover:text-brand-500"
                              title="Добавить подгруппу"
                            >
                              +
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ScheduleLegendBar() {
  const items = [
    { label: 'Обычный урок', className: 'border-slate-200 bg-white' },
    { label: 'Урок с подгруппами', className: 'border-blue-200 bg-blue-50' },
    { label: 'Критичный конфликт', className: 'border-red-300 bg-red-50' },
    { label: 'Предупреждение', className: 'border-amber-300 bg-amber-50' },
    { label: 'Пустой слот', className: 'border-dashed border-slate-300 bg-transparent' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className={cx('inline-block h-3.5 w-5 rounded-sm border', item.className)} />
          {item.label}
        </div>
      ))}
    </div>
  );
}
