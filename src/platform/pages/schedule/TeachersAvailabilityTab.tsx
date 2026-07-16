import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import {
  useTeacherAvailability,
  useTeachersList,
} from '@/platform/hooks/useTeacherAvailability';
import type { TeacherAvailability, TeacherRef } from '@/lib/schedule2bTypes';
import { cx } from '@/lib/format';

const TEACHER_ID_PARAM = 'teacherId';
const TEACHER_PAGE_PARAM = 'tPage';
const SEARCH_DEBOUNCE_MS = 300;

export type TeachersTabState = {
  teacherId: number | null;
  page: number;
};

export function parseTeachersTabState(params: URLSearchParams): TeachersTabState {
  const rawId = params.get(TEACHER_ID_PARAM);
  const parsedId = rawId != null ? Number(rawId) : NaN;
  const page = Number(params.get(TEACHER_PAGE_PARAM) ?? '0');
  return {
    teacherId: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null,
    page: Number.isFinite(page) && page >= 0 ? page : 0,
  };
}

export function writeTeachersTabState(next: URLSearchParams, state: TeachersTabState) {
  if (state.teacherId != null) next.set(TEACHER_ID_PARAM, String(state.teacherId));
  else next.delete(TEACHER_ID_PARAM);
  if (state.page > 0) next.set(TEACHER_PAGE_PARAM, String(state.page));
  else next.delete(TEACHER_PAGE_PARAM);
}

function teacherFullName(t: TeacherRef): string {
  return [t.lastName, t.firstName, t.middleName].filter(Boolean).join(' ');
}

/**
 * TODO(schedule-2b): list badge without N availability GETs / batch endpoint.
 * Unknown (not loaded) ≠ exists=false — only show «не задан» after a real GET.
 */
function AvailabilityStatusBadge({
  availability,
  loading,
  known,
}: {
  availability: TeacherAvailability | undefined;
  loading: boolean;
  /** false for rows we never fetched — neutral placeholder, not «не задан». */
  known: boolean;
}) {
  if (!known) {
    return <Badge tone="gray">—</Badge>;
  }
  if (loading) {
    return <Badge tone="gray">…</Badge>;
  }
  if (!availability || !availability.exists) {
    return (
      <Badge tone="gray" dot>
        не задан
      </Badge>
    );
  }
  if (availability.status === 'APPROVED') {
    return (
      <Badge tone="green" dot>
        утверждён
      </Badge>
    );
  }
  return (
    <Badge tone="gray" dot>
      неактивен
    </Badge>
  );
}

export function TeachersAvailabilityTab({
  state,
  onStateChange,
}: {
  state: TeachersTabState;
  onStateChange: (next: TeachersTabState) => void;
}) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const skipPageReset = useRef(true);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedName(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (skipPageReset.current) {
      skipPageReset.current = false;
      return;
    }
    if (state.page === 0) return;
    onStateChange({ ...state, page: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset page only when name filter changes
  }, [debouncedName]);

  const teachersQuery = useTeachersList(debouncedName, state.page);
  const selectedAvailability = useTeacherAvailability(state.teacherId);

  const teachers = teachersQuery.data?.content ?? [];
  const totalPages = teachersQuery.data?.totalPages ?? 0;

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Доступность учителей для конструктора расписания. Выберите учителя, чтобы открыть
        карточку графика (stage 7).
      </p>

      <div className="mb-4 sm:max-w-md">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Поиск по ФИО учителя"
        />
      </div>

      {teachersQuery.isLoading && <LoadingBlock label="Загрузка учителей…" />}
      {teachersQuery.isError && (
        <ErrorBlock
          message={
            teachersQuery.error instanceof Error
              ? teachersQuery.error.message
              : 'Не удалось загрузить список учителей'
          }
          onRetry={() => void teachersQuery.refetch()}
        />
      )}

      {!teachersQuery.isLoading && !teachersQuery.isError && teachers.length === 0 && (
        <EmptyBlock
          icon={<GraduationCap className="h-7 w-7" />}
          title={debouncedName ? 'Никого не найдено' : 'Нет учителей'}
          description={
            debouncedName
              ? 'Измените запрос или очистите поиск — фильтр уходит на сервер по имени.'
              : 'Добавьте учителей в разделе Platform Core, затем вернитесь сюда.'
          }
        />
      )}

      {teachers.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {teachers.map((teacher) => {
            const selected = state.teacherId === teacher.id;
            return (
              <li key={teacher.id}>
                <button
                  type="button"
                  onClick={() => onStateChange({ ...state, teacherId: teacher.id })}
                  className={cx(
                    'flex w-full items-center gap-4 px-4 py-3.5 text-left transition',
                    selected ? 'bg-brand-50/60' : 'hover:bg-slate-50',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {teacherFullName(teacher)}
                    </p>
                    <p className="truncate text-xs text-slate-500">{teacher.phone}</p>
                  </div>
                  <AvailabilityStatusBadge
                    known={selected}
                    availability={selected ? selectedAvailability.data : undefined}
                    loading={selected && selectedAvailability.isLoading}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={state.page <= 0 || teachersQuery.isFetching}
            onClick={() => onStateChange({ ...state, page: state.page - 1 })}
          >
            <ChevronLeft className="h-4 w-4" />
            Назад
          </Button>
          <p className="text-xs text-slate-500">
            Стр. {state.page + 1} из {totalPages}
          </p>
          <Button
            variant="secondary"
            size="sm"
            disabled={state.page + 1 >= totalPages || teachersQuery.isFetching}
            onClick={() => onStateChange({ ...state, page: state.page + 1 })}
          >
            Вперёд
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {state.teacherId != null && (
        <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Карточка доступности учителя #{state.teacherId} — stage 7.
        </p>
      )}
    </div>
  );
}
