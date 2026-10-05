import { Link } from 'react-router-dom';
import { GradeChip } from '@/components/ui/GradeChip';
import { cx } from '@/lib/format';
import type { ClassFinalGradeRow, Gradebook, GradebookColumn, GradebookRow } from '@/lib/gradebookApi';
import { GRADE_TYPE_LABELS, gradeValueLabel } from '@/lib/gradesModel';
import type { GradeType } from '@/lib/gradesApi';
import { COMPONENT_SHORT, componentsByCode, formatPercent, resultStatusHint } from '@/lib/gradingModel';
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
 *
 * <p><b>Четверть по политике оценивания</b> (GRADES-003) вместо «Ср. балла» показывает
 * проценты компонентов (ФО, СОР, СОЧ) и итоговый процент с рекомендацией — числа приходят
 * в строке готовыми. Итоговый процент открывает расшифровку: из каких работ и по какой
 * формуле он получен.
 */
export function JournalTable({
  journal,
  finals,
  today,
  onOpenBreakdown,
}: {
  journal: Gradebook;
  finals: Map<number, ClassFinalGradeRow>;
  today: string;
  onOpenBreakdown?: (row: GradebookRow) => void;
}) {
  const columns = journal.columns ?? [];
  const rows = journal.rows ?? [];
  const policy = journal.gradingPolicy ?? null;
  const policyComponents = policy?.components ?? [];

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
            {policy ? (
              <>
                {policyComponents.map((component, index) => (
                  <th
                    key={component.code}
                    title={`${component.title}, вес ${component.weightPercent}%`}
                    style={{ right: componentOffset(index, policyComponents.length) }}
                    className={cx(
                      STICKY,
                      COMPONENT_WIDTH,
                      'px-1 py-3 text-center text-11 font-bold uppercase text-slate-400',
                      index === 0 && STICKY_EDGE,
                    )}
                  >
                    {component.code ? COMPONENT_SHORT[component.code] : '—'} %
                  </th>
                ))}
                <th
                  title={policy.name ?? undefined}
                  style={{ right: FINAL_WIDTH_PX }}
                  className={cx(STICKY, 'w-24 min-w-24 px-2 py-3 text-center text-11 font-bold uppercase text-slate-400')}
                >
                  Итог %
                </th>
              </>
            ) : (
              <th
                style={{ right: FINAL_WIDTH_PX }}
                className={cx(STICKY, STICKY_EDGE, 'w-20 min-w-20 px-2 py-3 text-center text-11 font-bold uppercase text-slate-400')}
              >
                Ср. балл
              </th>
            )}
            <th className={cx(STICKY, 'right-0 w-24 min-w-24 px-2 py-3 text-center text-11 font-bold uppercase text-slate-400')}>
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
                              value={gradeValueLabel(grade)}
                              title={[
                                grade.gradeType ? GRADE_TYPE_LABELS[grade.gradeType as GradeType] : null,
                                column.title,
                              ]
                                .filter(Boolean)
                                .join(' · ') || undefined}
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

                {policy ? (
                  <ResultCells row={row} codes={policyComponents.map((c) => c.code ?? '')} onOpen={onOpenBreakdown} />
                ) : (
                  <td
                    style={{ right: FINAL_WIDTH_PX }}
                    className={cx(STICKY, STICKY_EDGE, 'w-20 min-w-20 px-2 py-2 text-center font-semibold text-slate-900')}
                  >
                    <span title={averageHint(row.average?.count, row.average?.visibleCount)}>
                      {formatAverage(row.average?.value)}
                    </span>
                  </td>
                )}
                <td className={cx(STICKY, 'right-0 w-24 min-w-24 px-2 py-2 text-center font-semibold text-slate-900')}>
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

/**
 * Проценты строки по политике: доля каждого компонента и итог с рекомендацией. Компонент
 * без работ — прочерк, а не 0%: «не писали СОЧ» и «написали на ноль» — разные факты.
 */
function ResultCells({
  row,
  codes,
  onOpen,
}: {
  row: GradebookRow;
  codes: string[];
  onOpen?: (row: GradebookRow) => void;
}) {
  const result = row.result;
  const byCode = componentsByCode(result);
  const hint = resultStatusHint(result);

  return (
    <>
      {codes.map((code, index) => {
        const component = byCode.get(code);
        return (
          <td
            key={code}
            style={{ right: componentOffset(index, codes.length) }}
            className={cx(
              STICKY,
              COMPONENT_WIDTH,
              'px-1 py-2 text-center text-13 text-slate-700',
              index === 0 && STICKY_EDGE,
              component?.contribution == null && 'text-slate-400',
            )}
            title={
              component?.workCount
                ? `${component.scoreSum} из ${component.maxSum}, работ: ${component.workCount}`
                : 'Работ нет'
            }
          >
            {component?.workCount ? formatPercent(component.percent) : '—'}
          </td>
        );
      })}
      <td style={{ right: FINAL_WIDTH_PX }} className={cx(STICKY, 'w-24 min-w-24 px-2 py-2 text-center')}>
        <button
          type="button"
          disabled={!onOpen}
          onClick={() => onOpen?.(row)}
          title={hint ?? 'Открыть расчёт'}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-slate-900 transition hover:bg-navy-50 hover:text-navy-700 disabled:hover:bg-transparent"
        >
          {result?.roundedPercent != null ? `${result.roundedPercent}%` : '—'}
          {result?.recommendedValue != null && (
            <span className="flex size-[22px] items-center justify-center rounded-md bg-slate-100 text-11 font-bold text-slate-600">
              {result.recommendedValue}
            </span>
          )}
        </button>
      </td>
    </>
  );
}

/**
 * Итоговые колонки закреплены справа: уроков в четверти два-три десятка, и без закрепления
 * проценты и итог оказывались за горизонтальной прокруткой — ради них журнал и открывают.
 * Ширины фиксированы, потому что от них считаются отступы закреплённых колонок.
 */
const STICKY = 'sticky z-10 bg-white';
/** Левая граница закреплённого блока — уроки уходят под неё при прокрутке. */
const STICKY_EDGE = 'border-l border-slate-200';
const COMPONENT_WIDTH = 'w-16 min-w-16';
const COMPONENT_WIDTH_PX = 64;
/** Ширина «Итог. четв.» и «Итог %» (`w-24`). */
const FINAL_WIDTH_PX = 96;

/** Отступ справа для i-го компонента: за ним остальные компоненты, «Итог %» и «Итог. четв.». */
function componentOffset(index: number, count: number): number {
  return FINAL_WIDTH_PX * 2 + COMPONENT_WIDTH_PX * (count - 1 - index);
}
