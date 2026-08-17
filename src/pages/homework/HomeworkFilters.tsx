import { useEffect, useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { cx } from '@/lib/format';
import { SCOPE_STATUSES, type HomeworkScope, type HomeworkStatus } from '@/lib/homeworkApi';

export interface HomeworkFilterValues {
  classId?: number;
  subjectId?: number;
  status?: HomeworkStatus;
  dueFrom?: string;
  dueTo?: string;
  pendingReviewOnly: boolean;
}

export const EMPTY_FILTERS: HomeworkFilterValues = { pendingReviewOnly: false };

export function hasActiveFilters(values: HomeworkFilterValues): boolean {
  return (
    values.classId != null
    || values.subjectId != null
    || values.status != null
    || Boolean(values.dueFrom)
    || Boolean(values.dueTo)
    || values.pendingReviewOnly
  );
}

const STATUS_LABELS: Record<HomeworkStatus, string> = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликовано',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено',
};

export interface FilterOption {
  id: number;
  name: string;
}

/**
 * Фильтры списка заданий (Figma 856:20520, ТЗ HOMEWORK-005.1 §4.3).
 *
 * Класс, предмет и статус вынесены наружу — их меняют чаще всего; период и «есть работы
 * на проверку» убраны под «Фильтры», как в макете.
 *
 * Статусы предлагаются только те, что есть на текущей вкладке: выбор «Завершено» на
 * «Актуальных» дал бы гарантированно пустую выдачу, и предлагать такой вариант — значит
 * предлагать тупик. При переключении вкладки несовместимый статус сбрасывается
 * вызывающим, а не молча остаётся в запросе.
 */
export function HomeworkFilters({
  scope,
  values,
  classes,
  subjects,
  onChange,
}: {
  scope: HomeworkScope;
  values: HomeworkFilterValues;
  classes: FilterOption[];
  subjects: FilterOption[];
  onChange: (next: HomeworkFilterValues) => void;
}) {
  const extraCount = countExtra(values);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterDropdown
        label="Класс"
        selectedLabel={classes.find((item) => item.id === values.classId)?.name}
        options={classes.map((item) => ({ value: String(item.id), label: item.name }))}
        value={values.classId != null ? String(values.classId) : ''}
        onSelect={(next) => onChange({ ...values, classId: next ? Number(next) : undefined })}
      />
      <FilterDropdown
        label="Предмет"
        selectedLabel={subjects.find((item) => item.id === values.subjectId)?.name}
        options={subjects.map((item) => ({ value: String(item.id), label: item.name }))}
        value={values.subjectId != null ? String(values.subjectId) : ''}
        onSelect={(next) => onChange({ ...values, subjectId: next ? Number(next) : undefined })}
      />
      <FilterDropdown
        label="Статус"
        selectedLabel={values.status ? STATUS_LABELS[values.status] : undefined}
        options={SCOPE_STATUSES[scope].map((status) => ({
          value: status,
          label: STATUS_LABELS[status],
        }))}
        value={values.status ?? ''}
        onSelect={(next) =>
          onChange({ ...values, status: next ? (next as HomeworkStatus) : undefined })
        }
      />
      <ExtraFiltersDropdown values={values} count={extraCount} onChange={onChange} />
    </div>
  );
}

function countExtra(values: HomeworkFilterValues): number {
  let count = 0;
  if (values.dueFrom || values.dueTo) count += 1;
  if (values.pendingReviewOnly) count += 1;
  return count;
}

const TRIGGER_CLASS = cx(
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3',
  'text-13 font-medium text-ink transition hover:border-navy-400',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50',
);

/** Пилюля-фильтр: подпись до выбора, значение после. Пустой вариант очищает фильтр. */
function FilterDropdown({
  label,
  selectedLabel,
  options,
  value,
  onSelect,
}: {
  label: string;
  selectedLabel?: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onSelect: (value: string) => void;
}) {
  const { open, setOpen, rootRef } = useDismissable();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cx(TRIGGER_CLASS, selectedLabel && 'border-navy-400 text-navy-700')}
      >
        {selectedLabel ?? label}
        <ChevronDown className={cx('size-4 text-subtle transition', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute right-0 z-30 mt-1 max-h-64 min-w-48 overflow-y-auto rounded-xl bg-surface py-1 shadow-popover ring-1 ring-line"
        >
          <FilterOptionRow
            label={`Все · ${label.toLowerCase()}`}
            selected={value === ''}
            muted
            onClick={() => {
              onSelect('');
              setOpen(false);
            }}
          />
          {options.map((option) => (
            <FilterOptionRow
              key={option.value}
              label={option.label}
              selected={option.value === value}
              onClick={() => {
                onSelect(option.value);
                setOpen(false);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterOptionRow({
  label,
  selected,
  muted = false,
  onClick,
}: {
  label: string;
  selected: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onClick}
        className={cx(
          'w-full px-3.5 py-2 text-left text-13 transition hover:bg-neutral-bg',
          selected && 'font-semibold text-navy-700',
          !selected && muted && 'text-muted',
          !selected && !muted && 'text-ink',
        )}
      >
        {label}
      </button>
    </li>
  );
}

/** Период по сроку сдачи и «есть работы на проверку» — редкие фильтры под одной кнопкой. */
function ExtraFiltersDropdown({
  values,
  count,
  onChange,
}: {
  values: HomeworkFilterValues;
  count: number;
  onChange: (next: HomeworkFilterValues) => void;
}) {
  const { open, setOpen, rootRef } = useDismissable();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cx(TRIGGER_CLASS, count > 0 && 'border-navy-400 text-navy-700')}
      >
        <SlidersHorizontal className="size-4 text-subtle" aria-hidden />
        Фильтры
        {count > 0 && (
          <span className="rounded-full bg-navy-700 px-1.5 text-10 font-semibold text-white">
            {count}
          </span>
        )}
        <ChevronDown className={cx('size-4 text-subtle transition', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Дополнительные фильтры"
          className="absolute right-0 z-30 mt-1 w-80 rounded-xl bg-surface p-4 shadow-popover ring-1 ring-line"
        >
          <p className="label-base">Срок сдачи</p>
          {/* `min-w-0` обязателен: у нативного `input[type=date]` своя минимальная ширина
              вместе с иконкой календаря, и без него пара полей распирает поповер наружу. */}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="date"
              aria-label="Срок с"
              value={values.dueFrom ?? ''}
              max={values.dueTo || undefined}
              onChange={(event) => onChange({ ...values, dueFrom: event.target.value || undefined })}
              className="input-base h-9 min-w-0 flex-1 px-2 text-13"
            />
            <span className="shrink-0 text-subtle">—</span>
            <input
              type="date"
              aria-label="Срок по"
              value={values.dueTo ?? ''}
              min={values.dueFrom || undefined}
              onChange={(event) => onChange({ ...values, dueTo: event.target.value || undefined })}
              className="input-base h-9 min-w-0 flex-1 px-2 text-13"
            />
          </div>
          {/* Задание без срока в период не попадает: у него нет даты, по которой его туда отнести. */}
          <p className="mt-1.5 text-11 text-subtle">
            Задания без срока в выбранный период не попадают
          </p>

          <label className="mt-4 flex items-center gap-2.5 text-13 text-ink">
            <input
              type="checkbox"
              checked={values.pendingReviewOnly}
              onChange={(event) =>
                onChange({ ...values, pendingReviewOnly: event.target.checked })
              }
              className="size-4 rounded border-line text-brand-500 focus:ring-brand-400/50"
            />
            Есть работы на проверку
          </label>
        </div>
      )}
    </div>
  );
}

/** Закрытие по клику вне и по Escape — общее поведение обеих всплывашек. */
function useDismissable() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return { open, setOpen, rootRef };
}
