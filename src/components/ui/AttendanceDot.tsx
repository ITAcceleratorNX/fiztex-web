import { cx } from '@/lib/format';
import { LEGEND, type DayMark } from '@/lib/attendanceJournalModel';

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

/**
 * Отметка посещаемости точкой — журнал учителя (Figma 2170:2360) и «Мой класс»
 * (2200:4046) рисуют её одинаково. `sm` — легенда, `md` — клетка таблицы.
 */
export function AttendanceDot({ mark, size = 'md' }: { mark: DayMark; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cx('inline-block shrink-0 rounded-full', size === 'sm' ? 'size-2' : 'size-2.5', DOT_TONE[mark])}
      aria-hidden
    />
  );
}

/** Figma `legend-row`: шесть значений точки. */
export function AttendanceLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {LEGEND.map((item) => (
        <li key={item.mark} className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <AttendanceDot mark={item.mark} size="sm" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
