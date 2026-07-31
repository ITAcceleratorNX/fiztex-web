import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Шапка подстраницы расписания: «Расписание → …» и заголовок 28px.
 * Одинакова во всех макетах разделов (2015:8034, 2015:12031, 2015:12093).
 */
export function ScheduleBreadcrumbs({ current }: { current: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-13">
        <Link to="/lesson-schedule" className="font-medium text-muted hover:text-navy-700">
          Расписание
        </Link>
        <ChevronRight className="size-3 text-gray-400" />
        <span className="font-semibold text-navy-700">{current}</span>
      </div>
      <h1 className="text-28 font-bold text-ink">{current}</h1>
    </div>
  );
}
