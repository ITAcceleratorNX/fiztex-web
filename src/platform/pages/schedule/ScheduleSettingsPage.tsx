import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useAcademicYears } from '@/platform/hooks/useScheduleSettings';
import { BellTemplatesTab } from './BellTemplatesTab';
import { WorkingDaysTab } from './WorkingDaysTab';
import {
  CalendarTab,
  DEFAULT_CALENDAR_FILTERS,
  type CalendarFilterState,
} from './CalendarTab';

type TabId = 'templates' | 'days' | 'calendar';

const TAB_PARAM = 'tab';
const YEAR_PARAM = 'year';
const C_TYPE = 'cType';
const C_STATUS = 'cStatus';
const C_FROM = 'cFrom';
const C_TO = 'cTo';
const C_PAGE = 'cPage';

function parseTab(raw: string | null): TabId {
  if (raw === 'days' || raw === 'calendar' || raw === 'templates') return raw;
  return 'templates';
}

function parseCalendarFilters(params: URLSearchParams): CalendarFilterState {
  const type = params.get(C_TYPE) ?? '';
  const statusRaw = params.get(C_STATUS);
  const status: CalendarFilterState['status'] =
    statusRaw === 'HIDDEN' || statusRaw === 'ALL' || statusRaw === 'ACTIVE'
      ? statusRaw
      : 'ACTIVE';
  const page = Number(params.get(C_PAGE) ?? '0');
  return {
    type: type as CalendarFilterState['type'],
    status,
    dateFrom: params.get(C_FROM) ?? '',
    dateTo: params.get(C_TO) ?? '',
    page: Number.isFinite(page) && page >= 0 ? page : 0,
  };
}

function writeCalendarFilters(next: URLSearchParams, filters: CalendarFilterState) {
  if (filters.type) next.set(C_TYPE, filters.type);
  else next.delete(C_TYPE);

  if (filters.status === DEFAULT_CALENDAR_FILTERS.status) next.delete(C_STATUS);
  else next.set(C_STATUS, filters.status);

  if (filters.dateFrom) next.set(C_FROM, filters.dateFrom);
  else next.delete(C_FROM);
  if (filters.dateTo) next.set(C_TO, filters.dateTo);
  else next.delete(C_TO);

  if (filters.page > 0) next.set(C_PAGE, String(filters.page));
  else next.delete(C_PAGE);
}

export function ScheduleSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get(TAB_PARAM));
  const yearParam = searchParams.get(YEAR_PARAM);
  const calendarFilters = useMemo(() => parseCalendarFilters(searchParams), [searchParams]);

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

  const selectedYearName = useMemo(
    () => years.find((y) => y.id === selectedYearId)?.name ?? '',
    [years, selectedYearId],
  );

  useEffect(() => {
    if (selectedYearId == null) return;
    if (yearParam === String(selectedYearId)) return;
    const next = new URLSearchParams(searchParams);
    next.set(YEAR_PARAM, String(selectedYearId));
    if (!next.get(TAB_PARAM)) next.set(TAB_PARAM, tab);
    setSearchParams(next, { replace: true });
  }, [selectedYearId, yearParam, searchParams, setSearchParams, tab]);

  function setYear(nextYearId: string) {
    const next = new URLSearchParams(searchParams);
    next.set(YEAR_PARAM, nextYearId);
    setSearchParams(next, { replace: true });
  }

  function setTab(nextTab: string) {
    const next = new URLSearchParams(searchParams);
    next.set(TAB_PARAM, nextTab);
    if (selectedYearId != null) next.set(YEAR_PARAM, String(selectedYearId));
    setSearchParams(next, { replace: true });
  }

  function setCalendarFilters(filters: CalendarFilterState) {
    const next = new URLSearchParams(searchParams);
    writeCalendarFilters(next, filters);
    setSearchParams(next, { replace: true });
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Базовые настройки расписания: шаблоны звонков, учебные дни школы и школьный календарь.
        Данные загружаются с backend (`feat/schedule-settings`).
      </p>

      <div className="mb-5 sm:w-64">
        <Select
          value={selectedYearId != null ? String(selectedYearId) : ''}
          onChange={(e) => setYear(e.target.value)}
          disabled={yearsQuery.isLoading || years.length === 0}
        >
          {years.length === 0 && <option value="">Нет учебных годов</option>}
          {years.map((year) => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </Select>
      </div>

      {yearsQuery.isLoading && <LoadingBlock label="Загрузка учебных годов…" />}
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

      {!yearsQuery.isLoading && !yearsQuery.isError && years.length === 0 && (
        <EmptyBlock
          title="Нет учебных годов"
          description="Создайте учебный год в разделе «Учебный год», затем вернитесь сюда."
        />
      )}

      {selectedYearId != null && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="templates">Шаблоны звонков</TabsTrigger>
            <TabsTrigger value="days">Учебные дни</TabsTrigger>
            <TabsTrigger value="calendar">Школьный календарь</TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <BellTemplatesTab yearId={selectedYearId} yearName={selectedYearName} />
          </TabsContent>
          <TabsContent value="days">
            <WorkingDaysTab yearId={selectedYearId} />
          </TabsContent>
          <TabsContent value="calendar">
            <CalendarTab
              yearId={selectedYearId}
              filters={calendarFilters}
              onFiltersChange={setCalendarFilters}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
