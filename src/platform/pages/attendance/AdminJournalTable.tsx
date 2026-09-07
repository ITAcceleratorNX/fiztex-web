import { Link } from 'react-router-dom';
import { cx } from '@/lib/format';
import type { AdminJournal, AdminJournalLesson, AdminJournalRow } from '@/lib/attendanceAdminApi';
import type { AttendanceMarking } from '@/lib/attendanceApi';
import { reasonLabel, sheetStateLabel, sheetStateShort, statusChip } from '@/lib/attendanceModel';

const TONE_CELL: Record<string, string> = {
  present: 'bg-success-bg text-success-fg',
  absent: 'bg-red-100 text-red-600',
  muted: 'bg-gray-100 text-subtle',
};

/** «Пр.» / «Отс.» / «—» — в клетке места на слово нет, полное значение уходит в title. */
const TONE_SHORT: Record<string, string> = {
  present: 'Пр.',
  absent: 'Отс.',
  muted: '—',
};

/**
 * Журнал школы: строки — ученики, столбцы — уроки месяца.
 *
 * <p><b>Только читает.</b> Отметку ставят на уроке, где у неё есть автор, версия и
 * история, — клетка отсюда ведёт туда же, куда и заголовок столбца. Второе место
 * правки означало бы вторую версию правил публикации.
 *
 * <p>Счётчики строк и сводка приходят с сервера и считаются по тем же клеткам, что
 * видно: сузили фильтр до болезней — цифры про болезни (контракт §23).
 */
export function AdminJournalTable({ journal }: { journal: AdminJournal }) {
  const lessons = journal.lessons ?? [];
  const rows = journal.rows ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="sticky left-0 z-10 w-56 bg-white px-4 py-3 text-left text-11 font-bold uppercase text-subtle">
              ФИО ученика
            </th>
            {lessons.map((lesson) => (
              <LessonHead key={lesson.lessonId} lesson={lesson} />
            ))}
            <th className="px-2 py-3 text-center text-11 font-bold uppercase text-subtle">Был</th>
            <th className="px-2 py-3 text-center text-11 font-bold uppercase text-subtle">Проп.</th>
            <th className="px-2 py-3 text-center text-11 font-bold uppercase text-subtle">Опозд.</th>
            <th className="px-2 py-3 text-center text-11 font-bold uppercase text-subtle">Освоб.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <StudentRow key={row.studentProfileId} row={row} lessons={lessons} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LessonHead({ lesson }: { lesson: AdminJournalLesson }) {
  const filled = lesson.state === 'PUBLISHED';
  return (
    <th className="px-1 py-2 text-center align-top">
      <Link
        to={`/lesson-schedule/lessons/${lesson.lessonId}/attendance`}
        title={[
          lesson.subjectName,
          lesson.subgroupName,
          lesson.teacherName,
          sheetStateLabel(lesson.state),
        ]
          .filter(Boolean)
          .join(' · ')}
        className="flex w-16 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"
      >
        <span className="text-13 font-semibold text-ink">{dayMonth(lesson.lessonDate)}</span>
        <span className="w-full truncate text-10 text-muted">{lesson.subjectName ?? '—'}</span>
        <span
          className={cx(
            'w-full truncate rounded px-1 text-[9px] font-semibold',
            filled ? 'bg-success-bg text-success-fg' : 'bg-attention-bg text-attention-fg',
          )}
        >
          {sheetStateShort(lesson.state)}
        </span>
      </Link>
    </th>
  );
}

function StudentRow({ row, lessons }: { row: AdminJournalRow; lessons: AdminJournalLesson[] }) {
  const byLesson = new Map(
    (row.cells ?? []).map((cell) => [cell.lessonId, cell.attendance ?? null]),
  );

  return (
    <tr className="border-b border-line last:border-b-0">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-white px-4 py-2 text-left text-13 font-normal text-ink"
      >
        <span className="block max-w-56 truncate">{row.fullName}</span>
      </th>
      {lessons.map((lesson) => (
        <Cell
          key={lesson.lessonId}
          lessonId={lesson.lessonId}
          marking={byLesson.get(lesson.lessonId) ?? null}
        />
      ))}
      <Total value={row.attendedCount} />
      <Total value={row.missedCount} />
      <Total value={row.lateCount} />
      <Total value={row.excusedCount} />
    </tr>
  );
}

function Cell({
  lessonId,
  marking,
}: {
  lessonId: number | undefined;
  marking: AttendanceMarking | null;
}) {
  const chip = statusChip(marking);
  const parts = [chip.label];
  if (marking?.mark === 'LATE') parts.push('опоздал');
  if (marking?.mark === 'EXCUSED') parts.push('освобождён');
  if (marking?.reason) parts.push(reasonLabel(marking.reason));

  return (
    <td className="px-1 py-1.5 text-center">
      <Link
        to={`/lesson-schedule/lessons/${lessonId}/attendance`}
        title={parts.join(' · ')}
        className={cx(
          'inline-flex h-7 w-16 items-center justify-center gap-0.5 rounded-md text-11 font-semibold transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
          TONE_CELL[chip.tone],
        )}
      >
        {TONE_SHORT[chip.tone]}
        {marking?.mark === 'LATE' && <span aria-hidden>⏱</span>}
        {marking?.mark === 'EXCUSED' && <span aria-hidden>✓</span>}
      </Link>
    </td>
  );
}

function Total({ value }: { value: number | undefined }) {
  return <td className="px-2 py-1.5 text-center text-13 tabular-nums text-ink">{value ?? 0}</td>;
}

/** «12.09» — в шапке столбца помещается только это; предмет и учитель уходят в title. */
function dayMonth(iso: string | undefined): string {
  if (!iso) return '—';
  const [, month, day] = iso.split('-');
  return month && day ? `${day}.${month}` : iso;
}
