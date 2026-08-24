import { forwardRef } from 'react';
import { cx } from '@/lib/format';

export type GradeChipSize = 'sm' | 'md';

/**
 * Оценка в клетке — квадрат со значением шкалы или пустое место под неё
 * (Figma 2098:267 «chip-empty», 2098:277 «chip-filled»).
 *
 * <p>Пустая клетка — такой же элемент управления, как заполненная: в макете это «+»
 * того же размера, и лист оценок из-за этого читается ровной сеткой, а не рваным
 * списком. Поэтому значение здесь необязательно, а не вынесено в отдельный компонент.
 *
 * <p>Размер `sm` — для журнала, где в строке двенадцать уроков подряд; `md` — для
 * листа урока, где клеток три.
 */
export const GradeChip = forwardRef<
  HTMLButtonElement,
  {
    value?: string | null;
    size?: GradeChipSize;
    disabled?: boolean;
    active?: boolean;
    title?: string;
    onClick?: () => void;
  }
>(function GradeChip({ value, size = 'md', disabled, active, title, onClick }, ref) {
  const filled = Boolean(value);
  const interactive = Boolean(onClick) && !disabled;

  return (
    <button
      ref={ref}
      type="button"
      title={title}
      disabled={!interactive}
      onClick={onClick}
      aria-label={filled ? `Оценка ${value}` : 'Поставить оценку'}
      className={cx(
        'flex shrink-0 items-center justify-center rounded-lg font-bold transition',
        size === 'md' ? 'size-8 text-sm' : 'size-[26px] text-13',
        filled
          ? 'bg-navy-700 text-white'
          : 'border border-slate-300 text-slate-400',
        interactive && (filled ? 'hover:bg-navy-800' : 'hover:border-navy-700 hover:text-navy-700'),
        !interactive && 'cursor-default',
        // Открытая клетка не должна теряться под поповером — обводка держит её на виду.
        active && 'ring-2 ring-navy-700 ring-offset-1',
      )}
    >
      {filled ? value : '+'}
    </button>
  );
});
