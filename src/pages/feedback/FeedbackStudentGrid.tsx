import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { cx } from '@/lib/format';
import type { FeedbackStudentRow } from '@/lib/monthlyFeedbackApi';
import { splitColumns, studentName, studentStatus, type StudentStatus } from '@/lib/monthlyFeedbackModel';

const STATUS: Record<StudentStatus, { label: string; tone: BadgeTone }> = {
  filled: { label: 'Заполнено', tone: 'green' },
  missing: { label: 'Не заполнено', tone: 'amber' },
  left: { label: 'Выбыл', tone: 'gray' },
};

/** DOM-id строки: к первой незаполненной прокручивает отказ публикации. */
export function studentRowId(studentProfileId: number | undefined): string {
  return `feedback-student-${studentProfileId ?? 'unknown'}`;
}

/**
 * Ученики листа двумя колонками (Figma `student-columns` 2162:2101). Строка целиком — кнопка:
 * в неё не целятся по мелкому значку, её открывают.
 *
 * <p>Незаполненная строка подсвечена, как в макете: при 11/24 глаз должен сразу находить,
 * кто остался, а не читать статусы по одному.
 */
export function FeedbackStudentGrid({
  students,
  onOpen,
}: {
  students: FeedbackStudentRow[];
  onOpen: (student: FeedbackStudentRow) => void;
}) {
  const columns = splitColumns(students);
  return (
    <div className="grid gap-2 lg:grid-cols-2 lg:gap-4">
      {columns.map((column, index) => (
        <ul key={index} className="flex flex-col gap-2">
          {column.map((student) => (
            <li key={student.studentProfileId}>
              <StudentRow student={student} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

function StudentRow({
  student,
  onOpen,
}: {
  student: FeedbackStudentRow;
  onOpen: (student: FeedbackStudentRow) => void;
}) {
  const status = studentStatus(student);
  const { label, tone } = STATUS[status];
  return (
    <button
      type="button"
      id={studentRowId(student.studentProfileId)}
      onClick={() => onOpen(student)}
      className={cx(
        'flex h-11 w-full items-center gap-3 rounded-xl border border-slate-200 px-3 text-left transition',
        'hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50',
        status === 'missing' ? 'bg-brand-50' : 'bg-white',
      )}
    >
      <span
        className={cx(
          'min-w-0 flex-1 truncate text-sm font-medium',
          status === 'left' ? 'text-slate-400' : 'text-slate-900',
        )}
      >
        {studentName(student)}
      </span>
      <Badge tone={tone}>{label}</Badge>
    </button>
  );
}
