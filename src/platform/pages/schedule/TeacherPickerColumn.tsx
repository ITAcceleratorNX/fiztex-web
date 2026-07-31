import { ChevronLeft, ChevronRight, Info, Search } from 'lucide-react';
import { cx } from '@/lib/format';
import type { TeacherAvailabilitySummary, TeacherAvailabilityState } from '@/lib/schedule2bTypes';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';

/** «Иванова Анна Михайловна» — шапка карточки (2015:10968). */
export function teacherFullName(teacher: {
  lastName: string;
  firstName: string;
  middleName: string | null;
}): string {
  return [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ');
}

/** «Иванова А.М.» — строка списка (2015:10889). */
export function teacherShortName(teacher: {
  lastName: string;
  firstName: string;
  middleName: string | null;
}): string {
  const initials = [teacher.firstName, teacher.middleName]
    .filter((part): part is string => Boolean(part))
    .map((part) => `${part[0]!.toUpperCase()}.`)
    .join('');
  return initials ? `${teacher.lastName} ${initials}` : teacher.lastName;
}

function avatarInitials(teacher: TeacherAvailabilitySummary): string {
  const first = teacher.lastName[0] ?? '';
  const second = teacher.firstName[0] ?? '';
  return `${first}${second}`.toUpperCase();
}

/** Пастельные подложки аватара из макета — по кругу, детерминированно по id. */
const AVATAR_TONES = [
  'bg-info-bg',
  'bg-emerald-50',
  'bg-purple-100',
  'bg-red-50',
  'bg-brand-50',
] as const;

export type AvailabilityFilter = TeacherAvailabilityState | null;

const FILTERS: Array<{ value: AvailabilityFilter; label: string }> = [
  { value: null, label: 'Все' },
  { value: 'APPROVED', label: 'Утверждено' },
  { value: 'NEEDS_REVIEW', label: 'Требует проверки' },
];

/**
 * Левая колонка экрана «Занятость учителей» (Figma 2015:10872):
 * поиск, фильтр по статусу, список учителей.
 */
export function TeacherPickerColumn({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  teachers,
  selectedTeacherId,
  onSelect,
  loading,
  error,
  onRetry,
  page,
  totalPages,
  onPageChange,
  paging,
}: {
  search: string;
  onSearchChange: (next: string) => void;
  filter: AvailabilityFilter;
  onFilterChange: (next: AvailabilityFilter) => void;
  teachers: TeacherAvailabilitySummary[];
  selectedTeacherId: number | null;
  onSelect: (teacherId: number) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  page: number;
  totalPages: number;
  onPageChange: (next: number) => void;
  paging: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 w-full shrink-0 flex-col gap-4 rounded-2xl border border-line bg-white p-4 lg:w-80">
      <label className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2.5 transition focus-within:border-navy-700">
        <Search className="size-3.5 shrink-0 text-subtle" aria-hidden />
        <span className="sr-only">Поиск учителя</span>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск учителя"
          className="w-full min-w-0 bg-transparent text-13 text-ink outline-none placeholder:text-subtle"
        />
      </label>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Фильтр по занятости">
        {FILTERS.map((option) => {
          const active = option.value === filter;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange(option.value)}
              className={cx(
                'rounded-full border px-3 py-1.5 text-xs transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
                active
                  ? 'border-navy-700 bg-info-bg font-semibold text-navy-700'
                  : 'border-line text-muted hover:bg-gray-50',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {loading && <LoadingBlock label="Загрузка учителей…" />}
      {error && !loading && <ErrorBlock message={error} onRetry={onRetry} />}

      {!loading && !error && teachers.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-info-bg">
            <Info className="size-6 text-navy-700" aria-hidden />
          </span>
          <p className="text-center text-sm font-semibold text-muted">Учителей не найдено</p>
        </div>
      )}

      {!loading && !error && teachers.length > 0 && (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {teachers.map((teacher, index) => (
            <li key={teacher.teacherId}>
              <TeacherRow
                teacher={teacher}
                tone={AVATAR_TONES[index % AVATAR_TONES.length]!}
                selected={teacher.teacherId === selectedTeacherId}
                onSelect={() => onSelect(teacher.teacherId)}
              />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <PageButton
            disabled={page <= 0 || paging}
            onClick={() => onPageChange(page - 1)}
            label="Предыдущая страница"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
          </PageButton>
          <p className="text-11 text-muted">
            Стр. {page + 1} из {totalPages}
          </p>
          <PageButton
            disabled={page + 1 >= totalPages || paging}
            onClick={() => onPageChange(page + 1)}
            label="Следующая страница"
          >
            <ChevronRight className="size-3.5" aria-hidden />
          </PageButton>
        </div>
      )}
    </div>
  );
}

function PageButton({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={cx(
        'inline-flex size-7 items-center justify-center rounded-lg border border-line text-muted transition',
        'hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
        'disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}

function TeacherRow({
  teacher,
  tone,
  selected,
  onSelect,
}: {
  teacher: TeacherAvailabilitySummary;
  tone: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const approved = teacher.availability === 'APPROVED';
  return (
    <button
      type="button"
      aria-current={selected ? 'true' : undefined}
      onClick={onSelect}
      className={cx(
        'flex w-full items-center justify-between gap-2 rounded-lg p-2.5 text-left transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700',
        selected ? 'bg-info-bg' : 'bg-white hover:bg-gray-50',
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className={cx(
            'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-ink',
            tone,
          )}
        >
          {avatarInitials(teacher)}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-13 font-semibold text-ink">
            {teacherShortName(teacher)}
          </span>
          <span className="truncate text-11 text-muted">
            {teacher.subjects.length > 0 ? teacher.subjects.join(', ') : 'Предмет не назначен'}
          </span>
        </span>
      </span>
      <span
        className={cx(
          'shrink-0 rounded px-2 py-0.5 text-10 font-semibold',
          approved ? 'bg-success-bg text-success-fg' : 'bg-attention-bg text-attention-fg',
        )}
      >
        {approved ? 'Утв.' : 'Проверить'}
      </span>
    </button>
  );
}
