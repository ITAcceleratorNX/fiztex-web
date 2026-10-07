import { forwardRef } from 'react';
import { cx } from '@/lib/format';

export type GradeChipSize = 'sm' | 'md';
export type GradeChipTone = 'solid' | 'soft' | 'outline';

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
 *
 * <p>Тон различает роль заполненной клетки там, где их рядом три (Figma 2200:3502, «Мой
 * класс — Оценки»): `soft` — текущая оценка, `outline` — СОР/СОЧ, `solid` — итог.
 * По умолчанию `solid`: так клетка выглядела до появления тонов, и журнал с листом урока
 * от них не меняются.
 */
export const GradeChip = forwardRef<
  HTMLButtonElement,
  {
    value?: string | null;
    size?: GradeChipSize;
    tone?: GradeChipTone;
    disabled?: boolean;
    active?: boolean;
    title?: string;
    onClick?: () => void;
  }
>(function GradeChip({ value, size = 'md', tone = 'solid', disabled, active, title, onClick }, ref) {
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
        // Ширина от содержимого: «15/20» у СОР не помещается в квадрат «4+» (GRADES-003).
        size === 'md' ? 'h-8 min-w-8 px-1 text-sm' : 'h-[26px] min-w-[26px] px-1 text-13',
        filled ? FILLED_TONE[tone] : 'border border-slate-300 text-slate-400',
        interactive && (filled ? FILLED_HOVER[tone] : 'hover:border-navy-700 hover:text-navy-700'),
        !interactive && 'cursor-default',
        // Открытая клетка не должна теряться под поповером — обводка держит её на виду.
        active && 'ring-2 ring-navy-700 ring-offset-1',
      )}
    >
      {filled ? value : '+'}
    </button>
  );
});

const FILLED_TONE: Record<GradeChipTone, string> = {
  solid: 'bg-navy-700 text-white',
  soft: 'bg-info-bg text-navy-700',
  outline: 'border border-navy-700 bg-surface text-navy-700',
};

const FILLED_HOVER: Record<GradeChipTone, string> = {
  solid: 'hover:bg-navy-800',
  soft: 'hover:bg-navy-100',
  outline: 'hover:bg-navy-50',
};
