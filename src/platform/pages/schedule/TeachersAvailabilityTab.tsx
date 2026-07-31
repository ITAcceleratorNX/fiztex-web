import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import type { AcademicYearRef } from '@/lib/scheduleSettingsTypes';
import { useTeacherAvailabilitySummaries, useTeacherAvailabilitySummary } from '@/platform/hooks/useTeacherAvailability';
import { useBellTemplate, useBellTemplates } from '@/platform/hooks/useScheduleSettings';
import { ScheduleBreadcrumbs } from './ScheduleBreadcrumbs';
import { TeacherAvailabilityPanel, EmptyPanel } from './TeacherAvailabilityPanel';
import { TeacherPickerColumn, type AvailabilityFilter } from './TeacherPickerColumn';
import { toGridPeriods } from './availabilityGrid';

/** Figma 2015:5831 — тот же select, что в расписании и шаблонах звонков. */
const FILTER_CONTROL =
  'w-auto min-w-44 rounded-lg border-line bg-gray-50 px-3 py-2 text-13 font-medium text-ink';

const TEACHER_ID_PARAM = 'teacherId';
const TEACHER_PAGE_PARAM = 'tPage';
const TEACHER_STATUS_PARAM = 'tStatus';
const TEACHER_TEMPLATE_PARAM = 'tTemplate';
const SEARCH_DEBOUNCE_MS = 300;

export type TeachersTabState = {
  teacherId: number | null;
  page: number;
  availability: AvailabilityFilter;
  /** Шаблон звонков задаёт строки сетки — уроки, а не произвольные интервалы. */
  templateId: number | null;
};

function parseId(raw: string | null): number | null {
  const parsed = raw != null ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseTeachersTabState(params: URLSearchParams): TeachersTabState {
  const page = Number(params.get(TEACHER_PAGE_PARAM) ?? '0');
  const status = params.get(TEACHER_STATUS_PARAM);
  return {
    teacherId: parseId(params.get(TEACHER_ID_PARAM)),
    page: Number.isFinite(page) && page >= 0 ? page : 0,
    availability: status === 'APPROVED' || status === 'NEEDS_REVIEW' ? status : null,
    templateId: parseId(params.get(TEACHER_TEMPLATE_PARAM)),
  };
}

export function writeTeachersTabState(next: URLSearchParams, state: TeachersTabState) {
  if (state.teacherId != null) next.set(TEACHER_ID_PARAM, String(state.teacherId));
  else next.delete(TEACHER_ID_PARAM);
  if (state.page > 0) next.set(TEACHER_PAGE_PARAM, String(state.page));
  else next.delete(TEACHER_PAGE_PARAM);
  if (state.availability) next.set(TEACHER_STATUS_PARAM, state.availability);
  else next.delete(TEACHER_STATUS_PARAM);
  if (state.templateId != null) next.set(TEACHER_TEMPLATE_PARAM, String(state.templateId));
  else next.delete(TEACHER_TEMPLATE_PARAM);
}

/**
 * Экран «Занятость учителей» (Figma 2015:10861 / 11058 / 11168 / 11200 / 11345).
 *
 * Селекторы года и шаблона звонков живут здесь, а не в шапке подстраницы:
 * шаблон определяет строки сетки, а год — и шаблон, и предметы учителей.
 */
export function TeachersAvailabilityTab({
  years,
  yearsLoading,
  yearId,
  onYearChange,
  state,
  onStateChange,
  onDirtyChange,
}: {
  years: AcademicYearRef[];
  yearsLoading: boolean;
  yearId: number | null;
  onYearChange: (next: number | null) => void;
  state: TeachersTabState;
  onStateChange: (next: TeachersTabState) => void;
  /** Наверх — чтобы страница успела предупредить об уходе с несохранённым. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dirty, setDirty] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState<number | null>(null);
  const skipPageReset = useRef(true);

  const handleDirtyChange = useCallback(
    (next: boolean) => {
      setDirty(next);
      onDirtyChange?.(next);
    },
    [onDirtyChange],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  // Новый запрос — новая нумерация: держать page от прошлой выборки нельзя.
  useEffect(() => {
    if (skipPageReset.current) {
      skipPageReset.current = false;
      return;
    }
    if (state.page === 0) return;
    onStateChange({ ...state, page: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сброс только при смене фильтров
  }, [debouncedSearch, state.availability, yearId]);

  const templatesQuery = useBellTemplates(yearId);
  const templates = useMemo(
    () => (templatesQuery.data?.content ?? []).map((t) => ({ id: t.id, name: t.name })),
    [templatesQuery.data],
  );
  const selectedTemplateId = useMemo(() => {
    if (state.templateId != null && templates.some((t) => t.id === state.templateId)) {
      return state.templateId;
    }
    return templates[0]?.id ?? null;
  }, [state.templateId, templates]);

  const templateQuery = useBellTemplate(selectedTemplateId);
  const periods = useMemo(
    () => toGridPeriods(templateQuery.data?.periods ?? []),
    [templateQuery.data],
  );

  const summariesQuery = useTeacherAvailabilitySummaries(
    yearId,
    debouncedSearch,
    state.availability,
    state.page,
  );
  const teachers = summariesQuery.data?.content ?? [];
  const totalPages = summariesQuery.data?.totalPages ?? 0;
  const selectedFromList = teachers.find((t) => t.teacherId === state.teacherId) ?? null;

  // Deep-link / переход из карточки: учитель может быть не на текущей странице списка.
  const selectedSummaryQuery = useTeacherAvailabilitySummary(
    state.teacherId,
    yearId,
    state.teacherId != null && selectedFromList == null,
  );
  const selectedTeacher = selectedFromList ?? selectedSummaryQuery.data ?? null;

  function requestSelectTeacher(teacherId: number) {
    if (state.teacherId === teacherId) return;
    if (dirty) {
      setLeaveConfirm(teacherId);
      return;
    }
    onStateChange({ ...state, teacherId });
  }

  function confirmLeave() {
    if (leaveConfirm == null) return;
    handleDirtyChange(false);
    onStateChange({ ...state, teacherId: leaveConfirm });
    setLeaveConfirm(null);
  }

  const templateHint = useMemo(() => {
    if (templatesQuery.isLoading || templateQuery.isLoading) return 'Загрузка шаблона звонков…';
    if (templates.length === 0) {
      return 'В учебном году нет шаблонов звонков — создайте шаблон, чтобы увидеть сетку уроков.';
    }
    if (periods.length === 0) {
      return 'В выбранном шаблоне звонков нет уроков — добавьте периоды, чтобы увидеть сетку.';
    }
    return null;
  }, [templatesQuery.isLoading, templateQuery.isLoading, templates.length, periods.length]);

  const listError = summariesQuery.isError
    ? summariesQuery.error instanceof Error
      ? summariesQuery.error.message
      : 'Не удалось загрузить список учителей'
    : null;

  return (
    <div className="flex flex-col gap-5">
      <ScheduleBreadcrumbs current="Занятость учителей" />
      <p className="text-13 text-muted">
        Проверьте и скорректируйте занятость учителя до составления расписания.
      </p>

      <div className="flex flex-wrap items-center gap-2.5">
        <Select
          value={yearId != null ? String(yearId) : ''}
          disabled={yearsLoading || years.length === 0}
          onChange={(e) => onYearChange(e.target.value ? Number(e.target.value) : null)}
          className={FILTER_CONTROL}
        >
          {years.length === 0 && <option value="">Учебный год</option>}
          {years.map((year) => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </Select>
        <Select
          value={selectedTemplateId != null ? String(selectedTemplateId) : ''}
          disabled={yearId == null || templatesQuery.isLoading || templates.length === 0}
          onChange={(e) =>
            onStateChange({
              ...state,
              templateId: e.target.value ? Number(e.target.value) : null,
            })
          }
          className={FILTER_CONTROL}
        >
          {templates.length === 0 && <option value="">Шаблон звонков</option>}
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </Select>
      </div>

      {templatesQuery.isError && (
        <ErrorBlock
          message="Не удалось загрузить шаблоны звонков"
          onRetry={() => void templatesQuery.refetch()}
        />
      )}

      {yearId == null ? (
        <EmptyBlock
          title="Выберите учебный год"
          description="Предметы учителей и сетка уроков зависят от выбранного года."
        />
      ) : (
        <div className="flex min-h-availability-columns flex-col gap-6 lg:flex-row lg:items-stretch">
          <TeacherPickerColumn
            search={searchInput}
            onSearchChange={setSearchInput}
            filter={state.availability}
            onFilterChange={(availability) => onStateChange({ ...state, availability, page: 0 })}
            teachers={teachers}
            selectedTeacherId={state.teacherId}
            onSelect={requestSelectTeacher}
            loading={summariesQuery.isLoading}
            error={listError}
            onRetry={() => void summariesQuery.refetch()}
            page={state.page}
            totalPages={totalPages}
            onPageChange={(page) => onStateChange({ ...state, page })}
            paging={summariesQuery.isFetching}
          />

          {selectedTeacher ? (
            <TeacherAvailabilityPanel
              key={selectedTeacher.teacherId}
              teacher={selectedTeacher}
              periods={periods}
              templateHint={templateHint}
              onDirtyChange={handleDirtyChange}
            />
          ) : state.teacherId != null && selectedSummaryQuery.isLoading ? (
            <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-5 rounded-2xl border border-line bg-white p-6">
              <LoadingBlock label="Загрузка учителя…" />
            </div>
          ) : state.teacherId != null && selectedSummaryQuery.isError ? (
            <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-5 rounded-2xl border border-line bg-white p-6">
              <ErrorBlock
                message={
                  selectedSummaryQuery.error instanceof Error
                    ? selectedSummaryQuery.error.message
                    : 'Не удалось загрузить учителя'
                }
                onRetry={() => void selectedSummaryQuery.refetch()}
              />
            </div>
          ) : (
            <EmptyPanel variant={teachers.length === 0 ? 'no-teachers' : 'no-selection'} />
          )}
        </div>
      )}

      <ConfirmDialog
        open={leaveConfirm != null}
        onClose={() => setLeaveConfirm(null)}
        onConfirm={confirmLeave}
        title="Несохранённые изменения"
        message="В карточке есть несохранённые изменения. Уйти без сохранения?"
        confirmLabel="Уйти"
        cancelLabel="Остаться"
        danger
      />
    </div>
  );
}
