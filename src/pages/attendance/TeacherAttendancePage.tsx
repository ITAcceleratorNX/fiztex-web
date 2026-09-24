import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarX2 } from 'lucide-react';
import { buttonClassName } from '@/components/ui/Button';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useMyTodayLessons } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cx, formatWeekdayDayMonth } from '@/lib/format';
import type { RoleScheduleLesson } from '@/lib/lessonsApi';
import { ROUTES } from '@/lib/routes';
import { hhmm } from '@/pages/schedule/myWeek';

/**
 * «Посещаемость (QR)» — уроки учителя на сегодня (Figma 2170:3959).
 *
 * <p>Кнопка «Показать QR» стоит у каждого урока, а не только у идущего: открыть код можно
 * лишь во время урока, но это правило бэкенда (`canOpen`), и страница кода сама объяснит
 * словами «с 13:00» или «урок закончился». Повторять правило времени здесь значило бы
 * однажды разойтись с сервером (ATTENDANCE-TEACHER-001 §0 п.4).
 */
export function TeacherAttendancePage() {
  useDocumentTitle('Посещаемость (QR)');
  const todayQuery = useMyTodayLessons();
  const lessons = todayQuery.data?.lessons ?? [];
  const today = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-800">Посещаемость (QR)</h1>
        <span className="text-sm text-slate-500">
          {formatWeekdayDayMonth(today)} {today.getFullYear()}
        </span>
      </div>
      <p className="text-sm text-slate-500">
        Выберите урок, чтобы показать QR-код для отметки посещаемости
      </p>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {todayQuery.isPending ? (
          <LoadingBlock />
        ) : todayQuery.isError ? (
          <ErrorBlock message="Не удалось загрузить уроки" onRetry={() => void todayQuery.refetch()} />
        ) : lessons.length === 0 ? (
          <EmptyBlock
            icon={<CalendarX2 className="size-6" />}
            title="Сегодня у вас нет уроков"
            description={todayQuery.data?.status !== 'ok' ? todayQuery.data?.message : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-200">
            {lessons.map((lesson, index) => (
              <LessonRow key={lesson.lessonInstanceId ?? `${lesson.startTime}-${index}`} lesson={lesson} />
            ))}
          </ul>
        )}
      </section>

      <Link
        to={ROUTES.myAttendanceMonth}
        className={cx(
          'inline-flex w-fit items-center gap-2 rounded-xl border-1.5 border-slate-200 p-3',
          'text-13 font-bold text-navy-700 transition hover:border-navy-100 hover:bg-navy-50',
        )}
      >
        <CalendarCheck className="size-4" aria-hidden />
        Посещаемость за месяц
      </Link>
    </div>
  );
}

/** Figma `lesson-1`: время, предмет, «класс · подгруппа · кабинет», кнопка кода. */
function LessonRow({ lesson }: { lesson: RoleScheduleLesson }) {
  const audience = [lesson.className ? `${lesson.className} класс` : null, lesson.subgroupName]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="flex min-w-0 items-center gap-4">
        <span className="w-28 shrink-0 text-sm font-medium text-slate-500">
          {hhmm(lesson.startTime)} – {hhmm(lesson.endTime)}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cx(
              'truncate text-sm font-medium',
              lesson.cancelled ? 'text-slate-400 line-through' : 'text-slate-800',
            )}
          >
            {lesson.subjectName}
          </span>
          <span className="flex flex-wrap items-center gap-2 text-13 text-slate-500">
            {audience && <span>{audience}</span>}
            {audience && lesson.room && <span className="text-slate-400">·</span>}
            {lesson.room && <span>Каб. {lesson.room}</span>}
          </span>
        </div>
      </div>

      {lesson.cancelled ? (
        // Отменённому уроку показывать классу нечего: код бэкенд всё равно не откроет.
        <span className="shrink-0 text-13 font-medium text-slate-400">Урок отменён</span>
      ) : lesson.lessonInstanceId != null ? (
        <Link
          to={ROUTES.myAttendanceQr(lesson.lessonInstanceId)}
          className={buttonClassName({ variant: 'navy', size: 'sm', className: 'shrink-0' })}
        >
          Показать QR
        </Link>
      ) : (
        // Урок в расписании есть, а фактического урока на дату ещё нет — открыть нечего.
        <span className="shrink-0 text-13 text-slate-400">Урок ещё не создан</span>
      )}
    </li>
  );
}
