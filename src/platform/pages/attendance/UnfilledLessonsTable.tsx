import { Link } from 'react-router-dom';
import { cx } from '@/lib/format';
import type { UnfilledLesson } from '@/lib/attendanceAdminApi';
import { sheetStateLabel } from '@/lib/attendanceModel';

/**
 * Закончившиеся уроки без публикации.
 *
 * <p>Незаполненным считается именно **закончившийся** урок: пока занятие идёт,
 * «не отмечено» — норма, а не повод беспокоить администратора. Черновик сюда тоже
 * попадает: ученик и родитель его не видят, значит посещаемости для них нет.
 *
 * <p>Строка ведёт в лист урока — закрывать его отсюда нельзя: публикация принадлежит
 * уроку вместе с его правилами времени и замен.
 */
export function UnfilledLessonsTable({ lessons }: { lessons: UnfilledLesson[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <Th>Дата</Th>
            <Th>Класс</Th>
            <Th>Предмет</Th>
            <Th>Учитель</Th>
            <Th>Состояние</Th>
            <Th className="text-right">Урок</Th>
          </tr>
        </thead>
        <tbody>
          {lessons.map((lesson) => (
            <tr key={lesson.lessonId} className="border-b border-line last:border-b-0">
              <td className="whitespace-nowrap px-4 py-2.5 text-13 text-ink">
                {formatDate(lesson.lessonDate)}
                {lesson.startTime && (
                  <span className="ml-2 text-muted tabular-nums">{hhmm(lesson.startTime)}</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-13 text-ink">
                {lesson.className ?? '—'}
                {lesson.subgroupName && (
                  <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-10 text-muted">
                    {lesson.subgroupName}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-13 text-ink">{lesson.subjectName ?? '—'}</td>
              <td className="px-4 py-2.5 text-13 text-muted">{lesson.teacherName ?? '—'}</td>
              <td className="px-4 py-2.5">
                <span
                  className={cx(
                    'rounded px-2 py-0.5 text-11 font-semibold',
                    lesson.state === 'DRAFT'
                      ? 'bg-info-bg text-navy-700'
                      : 'bg-attention-bg text-attention-fg',
                  )}
                >
                  {sheetStateLabel(lesson.state)}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right">
                <Link
                  to={`/lesson-schedule/lessons/${lesson.lessonId}/attendance`}
                  className="text-13 font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"
                >
                  Открыть →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cx(
        'px-4 py-3 text-left text-11 font-bold uppercase text-subtle',
        className,
      )}
    >
      {children}
    </th>
  );
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}.${month}.${year}` : iso;
}

function hhmm(time: string): string {
  return time.slice(0, 5);
}
