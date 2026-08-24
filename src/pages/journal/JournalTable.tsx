import { Link } from 'react-router-dom';
import { GradeChip } from '@/components/ui/GradeChip';
import { cx } from '@/lib/format';
import type { ClassFinalGradeRow, Gradebook, GradebookColumn } from '@/lib/gradebookApi';
import {
  cellsByColumn,
  columnCaption,
  finalValueLabel,
  formatAverage,
} from '@/lib/journalModel';

/**
 * Таблица журнала (Figma 2098:468).
 *
 * <p><b>Журнал только читает.</b> Оценку ставят на уроке — там она получает источник,
 * период и автора, — поэтому пустая клетка здесь не поле ввода, а ссылка в урок. Так же
 * ведёт себя и заголовок колонки: журнал остаётся зеркалом, а не вторым местом правки.
 *
 * <p>Колонка приходит и для отменённого урока (`active: false`, контракт §3): оценки на
 * ней настоящие и в среднем участвуют, новых не будет. Такой столбец рисуется
 * приглушённым — и это единственное, чем он отличается.
 */
export function JournalTable({
  journal,
  finals,
  today,
}: {
  journal: Gradebook;
  finals: Map<number, ClassFinalGradeRow>;
  today: string;
}) {
  const columns = journal.columns ?? [];
  const rows = journal.rows ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="sticky left-0 z-10 w-[180px] bg-white px-6 py-3 text-left text-11 font-bold uppercase text-slate-400">
              ФИО Ученика
            </th>
            {columns.map((column) => (
              <ColumnHead key={column.key} column={column} today={today} />
            ))}
            <th className="w-20 px-2 py-3 text-center text-11 font-bold uppercase text-slate-400">
              Ср. балл
            </th>
            <th className="w-24 px-2 py-3 text-center text-11 font-bold uppercase text-slate-400">
              Итог. четв.
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cells = cellsByColumn(row);
            const studentId = row.studentProfileId as number;
            return (
              <tr key={studentId} className="border-b border-slate-200 last:border-b-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-6 py-2 text-left font-normal text-slate-900"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate">{row.studentName}</span>
                    {row.currentMember === false && (
                      <span
                        title="Ученик больше не числится в этом классе — его оценки остаются в журнале"
                        className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-10 font-semibold text-slate-500"
                      >
                        выбыл
                      </span>
                    )}
                  </span>
                </th>

                {columns.map((column) => {
                  const cell = cells.get(column.key ?? '');
                  const grades = cell?.grades ?? [];
                  return (
                    <td
                      key={column.key}
                      className={cx(
                        'px-1 py-2 text-center align-middle',
                        column.date === today && 'bg-navy-50/60',
                      )}
                    >
                      {grades.length > 0 ? (
                        <span className="flex items-center justify-center gap-1">
                          {grades.map((grade) => (
                            <GradeChip
                              key={grade.id}
                              size="sm"
                              value={grade.scaleCode}
                              title={column.title ?? undefined}
                            />
                          ))}
                        </span>
                      ) : column.active === false ? (
                        <span className="text-slate-300" title="Занятие не состоялось">
                          ✕
                        </span>
                      ) : column.type === 'LESSON' && column.sourceId != null ? (
                        <Link
                          to={`/lesson-schedule/lessons/${column.sourceId}/grades`}
                          className="text-slate-300 transition hover:text-navy-700"
                          title="Открыть урок и выставить оценку"
                        >
                          +
                        </Link>
                      ) : (
                        <span className="text-slate-300">·</span>
                      )}
                    </td>
                  );
                })}

                <td className="px-2 py-2 text-center font-semibold text-slate-900">
                  <span title={averageHint(row.average?.count, row.average?.visibleCount)}>
                    {formatAverage(row.average?.value)}
                  </span>
                </td>
                <td className="px-2 py-2 text-center font-semibold text-slate-900">
                  {finalValueLabel(finals.get(studentId))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ColumnHead({ column, today }: { column: GradebookColumn; today: string }) {
  const caption = columnCaption(column);
  const isLesson = column.type === 'LESSON' && column.sourceId != null;
  const href = isLesson
    ? `/lesson-schedule/lessons/${column.sourceId}/grades`
    : column.sourceId != null
      ? `/homework/${column.sourceId}`
      : null;

  const content = (
    <span className="flex flex-col items-center gap-0.5">
      <span className={cx('text-13 font-semibold', column.active === false && 'text-slate-400')}>
        {caption.date}
      </span>
      <span className="text-10 font-medium uppercase text-slate-400">{caption.event}</span>
    </span>
  );

  return (
    <th
      scope="col"
      title={column.title ?? undefined}
      className={cx(
        'w-[78px] px-1 py-2 text-center font-normal',
        column.date === today && 'bg-navy-50/60',
      )}
    >
      {href ? (
        <Link to={href} className="block text-slate-900 transition hover:text-navy-700">
          {content}
        </Link>
      ) : (
        content
      )}
    </th>
  );
}

/**
 * `count > visibleCount` — не ошибка расчёта, а перевод ученика в середине четверти
 * (контракт §5): среднее считается по всей четверти, а журнал показывает один класс.
 */
function averageHint(count: number | undefined, visibleCount: number | undefined): string {
  if (count == null || visibleCount == null || count === visibleCount) return '';
  return `В среднем учтено ${count} оценок, в этом журнале видно ${visibleCount} — остальные получены в другом классе`;
}
