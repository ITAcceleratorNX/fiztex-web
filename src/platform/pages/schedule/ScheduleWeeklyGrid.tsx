import type { Weekday } from '@/lib/scheduleSettingsTypes';
import { WEEKDAY_LABELS } from '@/platform/labels';
import type {
  ConflictFinding,
  ScheduleGridView,
  ScheduleLesson,
} from '@/platform/services/schedules';
import { cx } from '@/lib/format';
import { eventsOn, overlapsOf, shortDate, timeRange, type LessonOverlap } from '@/lib/oneTimeEventModel';
import type { OneTimeEventOnSchedule } from '@/lib/oneTimeEventsApi';

/**
 * Недельная сетка расписания. Свёрстана по Figma 2015:5786 «Расписание — Просмотр»:
 * шапка 2015:5871, строка 2015:5884.
 *
 * Геометрия из макета: строка 80px, колонка номера 110px, дни — равные доли.
 * Рамка #e5e7eb на каждой ячейке (border-collapse), шапка на gray-50.
 */

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
  onOpenLesson,
  dates,
  oneTimeEvents = [],
  onOpenEvent,
}: {
  grid: ScheduleGridView;
  readOnly?: boolean;
  criticals?: ConflictFinding[];
  warnings?: ConflictFinding[];
  onAddSlot: (weekday: Weekday, periodId: number, lessonNumber: number) => void;
  onEditLesson: (lesson: ScheduleLesson) => void;
  /**
   * Переход к фактическому уроку этого слота. В режиме просмотра сетка показывает
   * опубликованный шаблон, и единственное осмысленное действие по клику — открыть
   * урок на ближайшую дату; в режиме правки клик по-прежнему редактирует слот.
   */
  onOpenLesson?: (lesson: ScheduleLesson) => void;
  /**
   * Даты дней выбранной недели — только у действующего опубликованного расписания: шаблон
   * черновика ни к какой неделе не привязан, и разовые события на нём не показываются.
   */
  dates?: Partial<Record<Weekday, string>>;
  /** Разовые события недели с перекрытиями, посчитанными сервером по слотам этой сетки. */
  oneTimeEvents?: OneTimeEventOnSchedule[];
  onOpenEvent?: (eventId: number) => void;
}) {
  const weekdays =
    grid.weekdays.length > 0
      ? grid.weekdays
      : (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as Weekday[]);
  const periods = [...grid.periods].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.lessonNumber - b.lessonNumber,
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] table-fixed border-collapse">
        <colgroup>
          <col className="w-[110px]" />
          {weekdays.map((day) => (
            <col key={day} />
          ))}
        </colgroup>

        <thead>
          {/* Figma 2015:5871 — шапка 36px, дни 13px SemiBold брендовым синим */}
          <tr className="h-9 bg-gray-50">
            <th className="border border-line text-center text-11 font-semibold uppercase text-gray-400">
              № урока
            </th>
            {weekdays.map((day) => (
              <th
                key={day}
                className="border border-line px-1 py-1.5 text-center align-top text-13 font-semibold text-navy-700"
              >
                {WEEKDAY_LABELS[day] ?? day}
                {dates?.[day] && (
                  <span className="ml-1 text-11 font-medium text-gray-400">{shortDate(dates[day]!)}</span>
                )}
                {dates?.[day] && eventsOn(oneTimeEvents, dates[day]!).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => event.id != null && onOpenEvent?.(event.id)}
                    title={event.title}
                    className="mt-1 flex w-full items-center gap-1 rounded-md bg-violet-100 px-1.5 py-0.5 text-left text-11 font-semibold normal-case text-violet-700 transition hover:bg-violet-200"
                  >
                    <span className="shrink-0">{timeRange(event)}</span>
                    <span className="truncate">{event.title}</span>
                  </button>
                ))}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {periods.length === 0 && (
            <tr>
              <td
                colSpan={weekdays.length + 1}
                className="border border-line px-3 py-16 text-center text-13 text-muted"
              >
                Нет слотов звонков — назначьте шаблон классу
              </td>
            </tr>
          )}

          {periods.map((period) => (
            <tr key={period.id} className="h-20">
              {/* Figma 2015:5885 — time-cell 110×80 */}
              <td className="border border-line p-3 text-center align-middle">
                <div className="text-13 font-bold text-ink">{period.lessonNumber}</div>
                <div className="text-10 text-gray-400">
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
                  <td key={`${day}-${period.id}`} className="border border-line p-1 align-middle">
                    {cellLessons.length === 0 ? (
                      readOnly ? (
                        // Легенда «Пустой слот»: прозрачный, пунктир #d1d5db
                        <div className="h-[72px] rounded-lg border border-dashed border-gray-300" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAddSlot(day, period.id, period.lessonNumber)}
                          className="flex h-[72px] w-full items-center justify-center rounded-lg border border-dashed border-gray-300 text-13 text-gray-400 transition hover:border-brand-400 hover:text-brand-600"
                        >
                          +
                        </button>
                      )
                    ) : (
                      // Figma 2015:5889 — filled-slot: rounded-8, p-10, gap-4, тень 0 1px 1px
                      <div
                        className={cx(
                          'flex min-h-[72px] gap-1 rounded-lg border p-1 shadow-slot',
                          hasCritical && 'border-red-500 bg-red-50',
                          hasWarning && 'border-brand-500 bg-brand-50',
                          !hasCritical && !hasWarning && isSubgroup && 'border-navy-700 bg-info-bg',
                          !hasCritical && !hasWarning && !isSubgroup && 'border-line bg-white',
                        )}
                      >
                        {cellLessons.map((lesson) => {
                          const opensLesson = readOnly && onOpenLesson != null;
                          const date = dates?.[day];
                          const overlaps = date ? overlapsOf(oneTimeEvents, lesson.id, date) : [];
                          const full = overlaps.find((o) => o.coverage === 'FULL');
                          if (full) {
                            return (
                              <EventInsteadOfLesson
                                key={lesson.id}
                                overlap={full}
                                subjectName={lesson.subjectName}
                                onOpenEvent={onOpenEvent}
                              />
                            );
                          }
                          return (
                          <div key={lesson.id} className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <button
                            type="button"
                            disabled={readOnly && !opensLesson}
                            title={opensLesson ? 'Открыть урок на ближайшую дату' : undefined}
                            onClick={() =>
                              opensLesson ? onOpenLesson(lesson) : onEditLesson(lesson)
                            }
                            className={cx(
                              'flex min-w-0 flex-1 flex-col gap-1 rounded-md px-1.5 py-1 text-left transition',
                              readOnly && !opensLesson ? 'cursor-default' : 'hover:bg-white/70',
                            )}
                          >
                            {/* Figma 2015:5890 — subject-row: предмет слева, бейдж справа */}
                            <span className="flex w-full items-center justify-between gap-1">
                              <span className="truncate text-xs font-bold text-ink">
                                {lesson.subjectName}
                              </span>
                              {lesson.targetType === 'SUBGROUP' && lesson.subgroupName ? (
                                <span className="shrink-0 rounded bg-info-bg px-1 text-10 font-semibold text-navy-700">
                                  {lesson.subgroupName}
                                </span>
                              ) : null}
                            </span>
                            <span className="truncate text-11 text-muted">
                              {shortTeacherName(lesson.teacherFullName)}
                            </span>
                            {lesson.room && overlaps.length === 0 ? (
                              <span className="truncate text-10 text-gray-400">
                                Каб. {lesson.room}
                              </span>
                            ) : null}
                          </button>
                          {overlaps.map((overlap) => (
                            <button
                              key={overlap.event.id}
                              type="button"
                              onClick={() => overlap.event.id != null && onOpenEvent?.(overlap.event.id)}
                              title={`${overlap.event.title} · ${overlap.overlapStart}–${overlap.overlapEnd}`}
                              className="flex items-center gap-1 rounded bg-violet-100 px-1 text-10 font-semibold text-violet-700 transition hover:bg-violet-200"
                            >
                              <span className="shrink-0">{overlap.overlapStart}–{overlap.overlapEnd}</span>
                              <span className="truncate">{overlap.event.title}</span>
                            </button>
                          ))}
                          </div>
                          );
                        })}

                        {!readOnly && isSubgroup && (
                          <button
                            type="button"
                            onClick={() => onAddSlot(day, period.id, period.lessonNumber)}
                            className="flex w-5 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-white hover:text-brand-500"
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
  );
}

/**
 * Урок, целиком закрытый разовым событием: на это время показывается событие, а урок — только
 * подписью. Сам урок не меняется — после отмены события сетка вернётся без правок.
 */
function EventInsteadOfLesson({
  overlap,
  subjectName,
  onOpenEvent,
}: {
  overlap: LessonOverlap;
  subjectName: string;
  onOpenEvent?: (eventId: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => overlap.event.id != null && onOpenEvent?.(overlap.event.id)}
      className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md bg-violet-100 px-1.5 py-1 text-left transition hover:bg-violet-200"
    >
      <span className="truncate text-xs font-bold text-violet-800">{overlap.event.title}</span>
      <span className="truncate text-11 text-violet-700">{timeRange(overlap.event)}</span>
      <span className="truncate text-10 text-violet-600/80 line-through">{subjectName}</span>
    </button>
  );
}

/** Figma 2015:5854 — legend-bar: gap 16, образец 14×14 с радиусом 3. */
export function ScheduleLegendBar() {
  const items = [
    { label: 'Обычный урок', className: 'border-line bg-white' },
    { label: 'Урок с подгруппами', className: 'border-navy-700 bg-info-bg' },
    { label: 'Критичный конфликт', className: 'border-red-500 bg-red-50' },
    { label: 'Предупреждение', className: 'border-brand-500 bg-brand-50' },
    { label: 'Пустой слот', className: 'border-dashed border-gray-300' },
    { label: 'Разовое событие', className: 'border-violet-300 bg-violet-100' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 pl-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={cx('size-3.5 shrink-0 rounded-[3px] border', item.className)} />
          <span className="text-11 font-medium text-muted">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
