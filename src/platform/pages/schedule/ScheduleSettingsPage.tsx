import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useAcademicYears } from '@/platform/hooks/useScheduleSettings';
import { BellTemplatesTab } from './BellTemplatesTab';
import { ScheduleBreadcrumbs } from './ScheduleBreadcrumbs';
import { WorkingDaysCard } from './WorkingDaysCard';
import {
  CalendarTab,
  DEFAULT_CALENDAR_FILTERS,
  type CalendarFilterState,
} from './CalendarTab';
import {
  parseTeachersTabState,
  TeachersAvailabilityTab,
  writeTeachersTabState,
  type TeachersTabState,
} from './TeachersAvailabilityTab';
import {
  parseSubgroupsTabState,
  SubgroupsTab,
  writeSubgroupsTabState,
  type SubgroupsTabState,
} from './SubgroupsTab';

/**
 * Разделы настроек расписания. Раньше были вкладками одной страницы
 * «Настройки расписания» в сайдбаре; теперь это подстраницы «Расписания»,
 * куда ведут карточки с самого экрана расписания.
 *
 * «Учебные дни» и «Школьный календарь» объединены в раздел `calendar`:
 * в макете 2015:9720 рабочие дни и события живут на одном экране.
 */
export type ScheduleSection = 'templates' | 'calendar' | 'teachers' | 'subgroups';

export const SCHEDULE_SECTION_TITLES: Record<ScheduleSection, string> = {
  templates: 'Шаблоны звонков',
  calendar: 'Школьный календарь',
  teachers: 'Занятость учителей',
  subgroups: 'Подгруппы классов',
};

const YEAR_PARAM = 'year';
const C_TYPE = 'cType';
const C_STATUS = 'cStatus';
const C_VIEW = 'cView';
const C_MONTH = 'cMonth';
const C_PAGE = 'cPage';

function parseCalendarFilters(params: URLSearchParams): CalendarFilterState {
  const type = params.get(C_TYPE) ?? '';
  const statusRaw = params.get(C_STATUS);
  const status: CalendarFilterState['status'] =
    statusRaw === 'HIDDEN' || statusRaw === 'ALL' || statusRaw === 'ACTIVE'
      ? statusRaw
      : 'ACTIVE';
  const page = Number(params.get(C_PAGE) ?? '0');
  const month = params.get(C_MONTH) ?? '';
  return {
    type: type as CalendarFilterState['type'],
    status,
    view: params.get(C_VIEW) === 'calendar' ? 'calendar' : 'list',
    month: /^\d{4}-\d{2}$/.test(month) ? month : '',
    page: Number.isFinite(page) && page >= 0 ? page : 0,
  };
}

function writeCalendarFilters(next: URLSearchParams, filters: CalendarFilterState) {
  if (filters.type) next.set(C_TYPE, filters.type);
  else next.delete(C_TYPE);

  if (filters.status === DEFAULT_CALENDAR_FILTERS.status) next.delete(C_STATUS);
  else next.set(C_STATUS, filters.status);

  if (filters.view === 'calendar') next.set(C_VIEW, filters.view);
  else next.delete(C_VIEW);

  if (filters.month) next.set(C_MONTH, filters.month);
  else next.delete(C_MONTH);

  if (filters.page > 0) next.set(C_PAGE, String(filters.page));
  else next.delete(C_PAGE);
}

/** Подгруппы и занятость учителей рисуют возврат и селекторы года сами. */
function ownsHeader(section: ScheduleSection): boolean {
  return section === 'templates' || section === 'calendar';
}

export function ScheduleSettingsPage({ section }: { section: ScheduleSection }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const yearParam = searchParams.get(YEAR_PARAM);
  const calendarFilters = useMemo(() => parseCalendarFilters(searchParams), [searchParams]);
  const teachersState = useMemo(() => parseTeachersTabState(searchParams), [searchParams]);
  const subgroupsState = useMemo(() => parseSubgroupsTabState(searchParams), [searchParams]);

  const [teachersDirty, setTeachersDirty] = useState(false);
  const handleTeachersDirty = useCallback((dirty: boolean) => {
    setTeachersDirty(dirty);
  }, []);

  const yearsQuery = useAcademicYears();
  const years = yearsQuery.data?.content ?? [];

  const selectedYearId = useMemo(() => {
    if (yearParam) {
      const parsed = Number(yearParam);
      if (Number.isFinite(parsed) && years.some((y) => y.id === parsed)) {
        return parsed;
      }
    }
    return years.find((y) => y.status === 'ACTIVE')?.id ?? years[0]?.id ?? null;
  }, [yearParam, years]);

  useEffect(() => {
    if (selectedYearId == null) return;
    if (yearParam === String(selectedYearId)) return;
    const next = new URLSearchParams(searchParams);
    next.set(YEAR_PARAM, String(selectedYearId));
    setSearchParams(next, { replace: true });
  }, [selectedYearId, yearParam, searchParams, setSearchParams]);

  useEffect(() => {
    if (!teachersDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [teachersDirty]);

  function setYear(nextYearId: string) {
    const next = new URLSearchParams(searchParams);
    next.set(YEAR_PARAM, nextYearId);
    setSearchParams(next, { replace: true });
  }

  function setCalendarFilters(filters: CalendarFilterState) {
    const next = new URLSearchParams(searchParams);
    writeCalendarFilters(next, filters);
    setSearchParams(next, { replace: true });
  }

  function setTeachersState(state: TeachersTabState) {
    const next = new URLSearchParams(searchParams);
    writeTeachersTabState(next, state);
    setSearchParams(next, { replace: true });
  }

  function setSubgroupsState(state: SubgroupsTabState) {
    const next = new URLSearchParams(searchParams);
    writeSubgroupsTabState(next, state);
    setSearchParams(next, { replace: true });
  }

  return (
    <div>
      {/* В подгруппах и занятости учителей и возврат, и год живут внутри
          страницы: хлебные крошки 2015:12031 / 2015:11349 и селекторы
          2015:12038. У занятости к году добавлен шаблон звонков — он задаёт
          строки сетки уроков. */}
      {ownsHeader(section) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/lesson-schedule"
            className="inline-flex items-center gap-1.5 text-13 font-semibold text-muted transition hover:text-navy-700"
          >
            <ArrowLeft className="size-4" />
            К расписанию
          </Link>

          <div className="w-full sm:w-56">
            <Select
              value={selectedYearId != null ? String(selectedYearId) : ''}
              onChange={(e) => setYear(e.target.value)}
              disabled={yearsQuery.isLoading || years.length === 0}
              className="w-full rounded-lg border-line bg-gray-50 px-3 py-2 text-13 font-medium text-ink"
            >
              {years.length === 0 && <option value="">Нет учебных годов</option>}
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {/* Подгруппы сами рисуют селекторы года и класса, поэтому рендерятся
          и без выбранного года — у них для этого есть отдельный экран. */}
      {section === 'subgroups' && (
        <SubgroupsTab
          years={years}
          yearsLoading={yearsQuery.isLoading}
          yearId={selectedYearId}
          onYearChange={(next) => setYear(next != null ? String(next) : '')}
          state={subgroupsState}
          onStateChange={setSubgroupsState}
        />
      )}

      {/* Занятость учителей рисует свои селекторы и пустые состояния сама. */}
      {section === 'teachers' && (
        <TeachersAvailabilityTab
          years={years}
          yearsLoading={yearsQuery.isLoading}
          yearId={selectedYearId}
          onYearChange={(next) => setYear(next != null ? String(next) : '')}
          state={teachersState}
          onStateChange={setTeachersState}
          onDirtyChange={handleTeachersDirty}
        />
      )}

      {ownsHeader(section) && yearsQuery.isLoading && (
        <LoadingBlock label="Загрузка учебных годов…" />
      )}
      {yearsQuery.isError && (
        <ErrorBlock
          message={
            yearsQuery.error instanceof Error
              ? yearsQuery.error.message
              : 'Не удалось загрузить учебные годы'
          }
          onRetry={() => void yearsQuery.refetch()}
        />
      )}

      {ownsHeader(section) &&
        !yearsQuery.isLoading &&
        !yearsQuery.isError &&
        years.length === 0 && (
          <EmptyBlock
            title="Нет учебных годов"
            description="Создайте учебный год в разделе «Учебный год», затем вернитесь сюда."
          />
        )}

      {selectedYearId != null && (
        <>
          {section === 'templates' && <BellTemplatesTab yearId={selectedYearId} />}

          {section === 'calendar' && (
            <div className="flex flex-col gap-6">
              <ScheduleBreadcrumbs current="Школьный календарь" />
              <WorkingDaysCard yearId={selectedYearId} />
              <CalendarTab
                yearId={selectedYearId}
                filters={calendarFilters}
                onFiltersChange={setCalendarFilters}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
