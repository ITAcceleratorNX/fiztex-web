import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, CalendarDays, CalendarRange } from 'lucide-react';
import { Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useAcademicYears } from '@/platform/hooks/useScheduleSettings';

type TabId = 'templates' | 'days' | 'calendar';

const TAB_PARAM = 'tab';
const YEAR_PARAM = 'year';

function parseTab(raw: string | null): TabId {
  if (raw === 'days' || raw === 'calendar' || raw === 'templates') return raw;
  return 'templates';
}

export function ScheduleSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get(TAB_PARAM));
  const yearParam = searchParams.get(YEAR_PARAM);

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
            <EmptyBlock
              icon={<Bell className="h-7 w-7" />}
              title="Шаблоны звонков"
              description="Список, редактор уроков, копии и привязки появятся на следующем этапе."
            />
          </TabsContent>
          <TabsContent value="days">
            <EmptyBlock
              icon={<CalendarDays className="h-7 w-7" />}
              title="Учебные дни"
              description="Выбор рабочих дней недели и предупреждения о занятости — на этапе 9."
            />
          </TabsContent>
          <TabsContent value="calendar">
            <EmptyBlock
              icon={<CalendarRange className="h-7 w-7" />}
              title="Школьный календарь"
              description="События с типом, эффектом и областью применения — на этапе 9."
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
