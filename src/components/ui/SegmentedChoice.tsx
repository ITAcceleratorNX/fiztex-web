import type { ReactNode } from 'react';
import { cx } from '@/lib/format';

/** Цвет выбранного варианта: navy — оценка, warning — ВНА, danger — НА (Figma 2209:178). */
export type SegmentedChoiceTone = 'navy' | 'warning' | 'danger';

export interface SegmentedChoiceOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Полное название под курсором и для скринридера, когда `label` — сокращение («ВНА»). */
  title?: string;
  tone?: SegmentedChoiceTone;
}

const selectedTone: Record<SegmentedChoiceTone, string> = {
  navy: 'bg-navy-700 text-white',
  warning: 'bg-amber-500 text-white',
  danger: 'bg-red-600 text-white',
};

/**
 * Выбор одного значения из короткого ряда (итог четверти «2 3 4 5», аттестация «ВНА НА»).
 *
 * Не `SegmentedTabs`: тот — переключатель вида, который меняет значение сам. Здесь нажатие —
 * намерение, а что с ним делать, решает экран: число сохраняется сразу, статус открывает окно с
 * причиной, нажатие по выбранному — окно «Изменить итог». Поэтому `onChoose` зовётся и для уже
 * выбранного варианта, а кнопки помечены `aria-pressed`, а не радиогруппой.
 *
 * `group` — ряд в общей рамке, как в ячейке таблицы (2209:178); `separate` — отдельные
 * квадраты 34 px, как «Новый итог» в окне (2209:1631); длинная подпись («Не изучался») растит
 * кнопку в ширину, а не переносится.
 */
export function SegmentedChoice<T extends string | number>({
  options,
  selected,
  onChoose,
  ariaLabel,
  appearance = 'group',
  disabled = false,
}: {
  options: readonly SegmentedChoiceOption<T>[];
  selected: T | null | undefined;
  onChoose: (value: T) => void;
  ariaLabel: string;
  appearance?: 'group' | 'separate';
  disabled?: boolean;
}) {
  const separate = appearance === 'separate';
  return (
    <span
      role="group"
      aria-label={ariaLabel}
      className={cx(
        'inline-flex items-center',
        separate ? 'flex-wrap gap-2' : 'gap-1 rounded-lg border border-slate-200 bg-white p-0.5',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={isSelected}
            aria-label={option.title}
            title={option.title}
            disabled={disabled}
            onClick={() => onChoose(option.value)}
            className={cx(
              'text-13 font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-300',
              separate
                ? 'h-[34px] min-w-[34px] whitespace-nowrap rounded-lg border px-2.5'
                : 'h-[26px] min-w-[26px] rounded-md px-1.5',
              isSelected
                ? cx(selectedTone[option.tone ?? 'navy'], separate && 'border-transparent')
                : cx('text-slate-500 hover:bg-slate-100 hover:text-navy-700', separate && 'border-slate-200 bg-white'),
            )}
          >
            {option.label}
          </button>
        );
      })}
    </span>
  );
}
