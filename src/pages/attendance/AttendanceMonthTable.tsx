import { AttendanceDot } from '@/components/ui/AttendanceDot';
import { cx } from '@/lib/format';
import type { JournalRow, MonthDay } from '@/lib/attendanceJournalModel';

/**
 * Таблица «ученики × дни месяца» (Figma 2170:2360).
 *
 * <p>Таблица растягивается по вертикали вместе со страницей. Внутри остаётся только
 * горизонтальное переполнение для тридцати колонок дней, а шапка дней и колонка ФИО
 * остаются липкими при прокрутке страницы и таблицы по горизонтали.
 *
 * <p>Клетка — точки уроков этого дня слева направо по времени. Под курсором и для
 * скринридера — какие уроки и что по каждому (`JournalCell.title`).
 */
export function AttendanceMonthTable({ days, rows }: { days: MonthDay[]; rows: JournalRow[] }) {
  return (
    <div className="overflow-x-auto overflow-y-clip rounded-2xl border border-slate-200 bg-white">
      <table className="w-max border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 top-0 z-20 h-journal-head w-journal-name border-b border-r border-slate-200 bg-white px-3.5 text-13 font-bold uppercase text-slate-400"
            >
              ФИО ученика
            </th>
            {days.map((day) => (
              <th
                key={day.date}
                scope="col"
                className={cx(
                  'sticky top-0 z-10 h-journal-head w-journal-day border-b border-slate-200 text-center',
                  day.weekend ? 'bg-slate-50 text-slate-400' : 'bg-white',
                )}
              >
                <span className={cx('block text-11', !day.weekend && 'text-slate-600')}>{day.weekday}</span>
                <span className={cx('block text-15 font-semibold', !day.weekend && 'text-slate-900')}>
                  {day.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.student.studentProfileId}>
              <th
                scope="row"
                title={row.student.fullName}
                className="sticky left-0 z-10 h-journal-row w-journal-name whitespace-nowrap border-b border-r border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900"
              >
                {row.shortName}
              </th>
              {days.map((day) => {
                const cell = row.cells.get(day.date);
                return (
                  <td
                    key={day.date}
                    title={cell?.title}
                    className={cx(
                      'h-journal-row w-journal-day border-b border-slate-200 text-center',
                      day.weekend && 'bg-slate-50',
                    )}
                  >
                    {cell && (
                      <>
                        <span className="inline-flex items-center justify-center gap-1" aria-hidden>
                          {cell.marks.slice(0, 3).map((mark, index) => (
                            <AttendanceDot key={index} mark={mark} />
                          ))}
                        </span>
                        <span className="sr-only">{cell.title}</span>
                      </>
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
