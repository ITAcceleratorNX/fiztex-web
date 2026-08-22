import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cx, formatWeekdayDayMonth } from '@/lib/format';
import { lessonsApi, type RoleScheduleLesson } from '@/lib/lessonsApi';
import { hhmm, lessonsAt, localDate, shiftDays, weekColumns, weekRows, weekState } from './myWeek';

/**
 * Своё расписание учителя.
 *
 * Отдельный экран, а не общий «/lesson-schedule»: админское расписание — конструктор, и
 * читает оно `/api/admin/*`, а учительскому токену это 401, который общий `request()`
 * считает концом сессии (см. `navConfig`). Здесь единственный источник — ролевой
 * `/api/schedule/me/week`, тот же, из которого неделю показывает мобильное приложение.
 *
 * Экран — вход в урок: по клетке открывается карточка урока с темой, посещаемостью и
 * домашними заданиями. Поэтому клетка без фактического урока (за горизонтом генерации)
 * не нажимается — вести ей некуда.
 */
export function MySchedulePage() {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(() => localDate());

  useDocumentTitle('Моё расписание');

  const weekQuery = useQuery({
    queryKey: ['schedule', 'me', 'week', anchor],
    queryFn: ({ signal }) => lessonsApi.myWeek(anchor, signal),
    staleTime: 60_000,
  });

  const view = weekQuery.data;
  const lessons = view?.lessons ?? [];
  const columns = weekColumns(view?.weekStart, view?.workingDays);
  const rows = weekRows(lessons);
  const state = weekState(view);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-28 font-bold text-ink">Моё расписание</h1>
          {view?.weekStart && view?.weekEnd && (
            <p className="text-13 text-muted">
              {formatWeekdayDayMonth(view.weekStart)} — {formatWeekdayDayMonth(view.weekEnd)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Предыдущая неделя"
            onClick={() => setAnchor((current) => shiftDays(current, -7))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAnchor(localDate())}>
            Текущая неделя
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Следующая неделя"
            onClick={() => setAnchor((current) => shiftDays(current, 7))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {weekQuery.isPending ? (
        <div className="card"><LoadingBlock label="Загрузка расписания…" /></div>
      ) : weekQuery.isError ? (
        <div className="card">
          <ErrorBlock
            message="Не удалось загрузить расписание"
            onRetry={() => void weekQuery.refetch()}
          />
        </div>
      ) : state.kind === 'empty' ? (
        <div className="card">
          <EmptyBlock title="Уроков на этой неделе нет" description={state.message} />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyBlock
            title="Уроков на этой неделе нет"
            description="Расписание опубликовано, но уроков у вас на этой неделе не назначено."
          />
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[840px] table-fixed border-collapse">
            <colgroup>
              <col className="w-[92px]" />
              {columns.map((column) => (
                <col key={column.date} />
              ))}
            </colgroup>

            <thead>
              <tr className="h-9 bg-neutral-bg">
                <th className="border border-line text-center text-11 font-semibold uppercase text-subtle">
                  № урока
                </th>
                {columns.map((column) => (
                  <th
                    key={column.date}
                    className={cx(
                      'border border-line text-center text-13 font-semibold',
                      column.isToday ? 'text-brand-600' : 'text-navy-700',
                    )}
                  >
                    {column.label}, {column.dayNumber}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="h-[72px]">
                  <td className="border border-line p-2 text-center align-middle">
                    <div className="text-13 font-bold text-ink">{row.number ?? '—'}</div>
                    {row.time && <div className="text-10 text-subtle">{row.time}</div>}
                  </td>

                  {columns.map((column) => {
                    const cell = lessonsAt(lessons, row.key, column.date);
                    return (
                      <td
                        key={`${row.key}-${column.date}`}
                        className={cx(
                          'border border-line p-1 align-middle',
                          column.isToday && 'bg-brand-50/40',
                        )}
                      >
                        <div className="flex h-full gap-1">
                          {cell.map((lesson, index) => (
                            <LessonCell
                              key={lesson.lessonInstanceId ?? `${lesson.lessonId}-${index}`}
                              lesson={lesson}
                              onOpen={() =>
                                navigate(`/lesson-schedule/lessons/${lesson.lessonInstanceId}`)
                              }
                            />
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-center gap-2 text-11 text-subtle">
        <CalendarDays className="size-3.5" aria-hidden />
        По уроку открывается карточка: тема, посещаемость и домашние задания этого урока.
      </p>
    </div>
  );
}

/**
 * Клетка урока. Отменённый урок остаётся на месте и говорит об этом прямо: убрать его
 * значило бы показать учителю неверную неделю, а не «освободить время».
 */
function LessonCell({ lesson, onOpen }: { lesson: RoleScheduleLesson; onOpen: () => void }) {
  const openable = lesson.lessonInstanceId != null;
  const target = [lesson.className, lesson.subgroupName].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      disabled={!openable}
      onClick={onOpen}
      title={openable ? 'Открыть урок' : 'Урок ещё не сгенерирован'}
      className={cx(
        'flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border p-1.5 text-left transition',
        lesson.cancelled ? 'border-line bg-neutral-bg/60' : 'border-line bg-surface',
        openable ? 'hover:border-brand-300 hover:bg-brand-50/40' : 'cursor-default opacity-70',
      )}
    >
      <span className="flex items-center justify-between gap-1">
        <span
          className={cx(
            'truncate text-xs font-bold',
            lesson.cancelled ? 'text-subtle line-through' : 'text-ink',
          )}
        >
          {lesson.subjectName}
        </span>
        <span className="shrink-0 text-10 text-subtle">{hhmm(lesson.startTime)}</span>
      </span>
      {target && <span className="truncate text-11 text-muted">{target}</span>}
      <span className="truncate text-10 text-subtle">
        {lesson.cancelled ? 'Урок отменён' : lesson.room ? `Каб. ${lesson.room}` : ''}
      </span>
    </button>
  );
}
