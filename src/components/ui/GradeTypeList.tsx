import { cx } from '@/lib/format';

export type GradeTypeOption<T extends string> = {
  /** `null` — пункт «без типа» у шкальной оценки. */
  value: T | null;
  label: string;
  /** Короткая пометка справа: компонент расчёта («ФО», «СОЧ») или «не учитывается». */
  hint?: string;
};

/**
 * Список видов работы в поповере оценки (Figma 2098:384 «grade-type-dropdown»).
 *
 * <p>Общий для `GradePicker` (шкала 2…5) и `PointsPicker` (10 баллов и баллы из максимума):
 * у второго вид работы раньше выбирался нативным `<select>`, и поповеры одного листа урока
 * выглядели по-разному. Одна вёрстка на оба — чтобы они не разъехались снова.
 */
export function GradeTypeList<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  /** Имя группы для скринридера. */
  label: string;
  options: GradeTypeOption<T>[];
  selected: T | null | undefined;
  onSelect: (value: T | null) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex max-h-64 flex-col overflow-y-auto">
      {options.map((option) => {
        const active = option.value === (selected ?? null);
        return (
          <button
            key={option.value ?? ''}
            type="button"
            aria-pressed={active}
            title={option.label}
            onClick={() => onSelect(option.value)}
            className={cx(
              'flex h-8 shrink-0 items-center justify-between gap-2 rounded-lg px-3 text-left text-13 transition',
              active
                ? 'bg-navy-50 font-semibold text-navy-700'
                : 'font-medium text-slate-600 hover:bg-slate-50',
            )}
          >
            <span className="truncate">{option.label}</span>
            {/* Пробел не виден во flex-строке, но разделяет слова в имени кнопки для диктора. */}
            {option.hint && ' '}
            {option.hint && (
              <span className={cx('shrink-0 text-11 font-medium', active ? 'text-navy-700' : 'text-muted')}>
                {option.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
