import { cx } from '@/lib/format';

/**
 * Переключаемая плашка-вариант.
 *
 * `solid` — фильтр списка: серая плашка, выбранная — navy. `outline` — готовый ответ, который
 * подставляется в поле (Figma `phyztex` 2460:2400, «Частые причины» отказа): белая с рамкой
 * на радиусе 16, выбранная — бледно-синяя с navy-рамкой.
 */
export function FilterChip({ label, selected, onClick, appearance = 'solid' }: {
  label: string;
  selected: boolean;
  onClick: () => void;
  appearance?: 'solid' | 'outline';
}) {
  return <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={cx(
      'shrink-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 focus-visible:ring-offset-2',
      appearance === 'outline'
        ? cx('rounded-2xl border px-3 py-2 text-13 leading-4', selected ? 'border-navy-700 bg-navy-50 font-semibold text-navy-700' : 'border-line bg-surface font-medium text-slate-600 hover:bg-planning-canvas')
        : cx('rounded-lg px-3 py-1.5 text-xs font-semibold', selected ? 'bg-navy-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'),
    )}
  >{label}</button>;
}
