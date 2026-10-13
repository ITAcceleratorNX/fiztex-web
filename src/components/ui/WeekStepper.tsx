import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '@/lib/format';

/**
 * Переключатель недели (Figma 2200:3285 `week-selector`): подпись капсом и поле с
 * диапазоном между стрелками «назад / вперёд». Геометрия та же, что у `FilterSelect`
 * (высота 36, радиус 8, slate-50), — в строке фильтров они стоят рядом.
 *
 * Компонент только листает: какую неделю показывать и как подписать диапазон, решает экран.
 */
export function WeekStepper({
  label = 'Неделя',
  value,
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  className,
}: {
  label?: string;
  /** Подпись недели: «13 – 17 октября 2026». */
  value: string;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const arrow = 'flex size-6 items-center justify-center rounded text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';
  return (
    <div role="group" aria-labelledby={id} className={cx('flex flex-col gap-1', className)}>
      <span id={id} className="text-10 font-semibold uppercase tracking-filter text-slate-500">{label}</span>
      <div className="flex h-9 w-60 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-slate-50 px-2">
        <button type="button" className={arrow} onClick={onPrevious} disabled={previousDisabled} aria-label="Предыдущая неделя">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="truncate text-sm font-medium text-slate-700" aria-live="polite">{value}</span>
        <button type="button" className={arrow} onClick={onNext} disabled={nextDisabled} aria-label="Следующая неделя">
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
