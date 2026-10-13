import type { Schema } from '@/lib/apiSchemas';
import { DAY_MARK_LABEL, shortNames, type DayMark } from '@/lib/attendanceJournalModel';
import { shortDate } from '@/lib/journalModel';

type Journal = Schema<'MyClassAttendanceJournalView'>;
type Lesson = Schema<'MyClassAttendanceLessonView'>;
type CellState = NonNullable<Schema<'MyClassAttendanceCellView'>['state']>;

/**
 * Вкладка «Посещаемость» классного руководителя (Figma 2200:4046).
 *
 * <p>Клетки приходят готовыми: кто в составе урока, опубликован ли лист и что в нём стоит,
 * решает сервер (`/attendance-journal`). Здесь только перевод состояния в точку и слова
 * журнала учителя — одно состояние не должно называться на двух экранах по-разному.
 */

const MARK_OF: Record<CellState, DayMark> = {
  PRESENT: 'present',
  LATE: 'late',
  ABSENT: 'absent',
  EXCUSED: 'excused',
  NOT_PUBLISHED: 'unpublished',
  CANCELLED: 'cancelled',
};

export interface AttendanceColumn {
  lessonId: number;
  date: string;
  /** Нижняя строка шапки: «Урок», подгруппа или «Отменён». */
  event: string;
  cancelled: boolean;
  title: string;
}

export interface AttendanceRow {
  studentProfileId: number;
  fullName: string;
  shortName: string;
  /** Нет ключа — урок не этого ученика: чужая подгруппа или до зачисления. */
  cells: Map<number, { mark: DayMark; title: string }>;
}

function column(lesson: Lesson): AttendanceColumn {
  const cancelled = lesson.status === 'CANCELLED';
  const date = lesson.date ? shortDate(lesson.date) : '';
  const time = (lesson.startTime ?? '').slice(0, 5);
  return {
    lessonId: lesson.lessonId as number,
    date,
    event: cancelled ? 'Отменён' : lesson.subgroupName ?? 'Урок',
    cancelled,
    title: [date, time, lesson.subgroupName, cancelled ? 'урок отменён' : null].filter(Boolean).join(' · '),
  };
}

export function buildAttendanceJournal(journal: Journal): { columns: AttendanceColumn[]; rows: AttendanceRow[] } {
  const columns = (journal.lessons ?? []).map(column);
  const byId = new Map(columns.map((item) => [item.lessonId, item]));
  const rows = journal.rows ?? [];
  const short = shortNames(rows.map((row) => row.studentName));
  return {
    columns,
    rows: rows.map((row, index) => ({
      studentProfileId: row.studentProfileId as number,
      fullName: row.studentName ?? '',
      shortName: short[index],
      cells: new Map((row.cells ?? []).flatMap((cell) => {
        if (cell.lessonId == null || cell.state == null) return [];
        const mark = MARK_OF[cell.state];
        const lesson = byId.get(cell.lessonId);
        return [[cell.lessonId, { mark, title: `${lesson?.title ?? ''} — ${DAY_MARK_LABEL[mark]}` }]];
      })),
    })),
  };
}
