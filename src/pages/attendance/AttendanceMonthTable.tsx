import { cx } from '@/lib/format';
import { LEGEND, type DayMark, type JournalRow, type MonthDay } from '@/lib/attendanceJournalModel';

/**
 * Цвет точки. Палитра — стандартная Tailwind, ровно те значения, что в макете
 * (Figma `legend-row`, клетки 2170:2609): green-600, red-500, orange-400, blue-500,
 * slate-400. Отменённый урок — пустое кольцо того же серого.
 */
const DOT_TONE: Record<DayMark, string> = {
  present: 'bg-green-600',
  late: 'bg-orange-400',
  absent: 'bg-red-500',
  excused: 'bg-blue-500',
  unpublished: 'bg-slate-400',
  cancelled: 'border border-slate-400',
};

/** Figma `legend-row`: шесть значений точки. */
export function AttendanceLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {LEGEND.map((item) => (
        <li key={item.mark} className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <span className={cx('size-2 rounded-full', DOT_TONE[item.mark])} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

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
                            <span key={index} className={cx('size-2.5 rounded-full', DOT_TONE[mark])} />
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
