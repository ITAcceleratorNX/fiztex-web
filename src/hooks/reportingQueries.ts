import { useQuery } from '@tanstack/react-query';
import { pageQuery, request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

/**
 * Учебная отчётность: один набор запросов на два адреса.
 *
 * <p>Администратор читает `/api/admin/academic-reports/*` по всей школе; классный
 * руководитель — `/api/my-class/classes/{classId}/academic-reports/*` по своему классу.
 * Права решает сервер; клиент лишь не шлёт руководителю параметров, которых у него нет
 * (`classId`, `teacherProfileId`), — сервер отказал бы им `FILTER_NOT_ALLOWED`.
 */
export type ReportOwner = { kind: 'admin' } | { kind: 'homeroom'; classId: number };

export type ReportDimension = 'CLASS' | 'SUBJECT' | 'TEACHER' | 'STUDENT';

export interface ReportFilter {
  academicYearId: number;
  academicPeriodId?: number | null;
  classId?: number | null;
  subjectId?: number | null;
  teacherProfileId?: number | null;
  studentProfileId?: number | null;
}

type Summary = Schema<'AcademicReportSummaryView'>;
type Breakdown = Schema<'AcademicReportBreakdownView'>;
type FinalPage = Schema<'AcademicReportFinalGradePageView'>;

/** Страница ответа ограничена сотней строк; таблице нужны все — дочитываем до конца. */
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

function base(owner: ReportOwner): string {
  return owner.kind === 'admin'
    ? '/admin/academic-reports'
    : `/my-class/classes/${owner.classId}/academic-reports`;
}

function params(owner: ReportOwner, filter: ReportFilter): Record<string, number | undefined> {
  const admin = owner.kind === 'admin';
  return {
    academicYearId: filter.academicYearId,
    academicPeriodId: filter.academicPeriodId ?? undefined,
    classId: admin ? filter.classId ?? undefined : undefined,
    subjectId: filter.subjectId ?? undefined,
    teacherProfileId: admin ? filter.teacherProfileId ?? undefined : undefined,
    studentProfileId: filter.studentProfileId ?? undefined,
  };
}

function ownerKey(owner: ReportOwner) {
  return owner.kind === 'admin' ? ['admin'] as const : ['homeroom', owner.classId] as const;
}

export function useReportSummary(owner: ReportOwner, filter: ReportFilter | null) {
  return useQuery({
    queryKey: ['academic-reports', ...ownerKey(owner), 'summary', filter],
    enabled: filter != null,
    queryFn: ({ signal }) => request<Summary>(`${base(owner)}/summary${pageQuery(params(owner, filter!))}`, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Все строки разреза и их общее число (`totalElements`). */
export function useReportBreakdown(owner: ReportOwner, filter: ReportFilter | null, dimension: ReportDimension | null) {
  return useQuery({
    queryKey: ['academic-reports', ...ownerKey(owner), 'breakdown', dimension, filter],
    enabled: filter != null && dimension != null,
    queryFn: async ({ signal }) => {
      const rows: NonNullable<Breakdown['items']> = [];
      let total = 0;
      for (let page = 0; page < MAX_PAGES; page++) {
        const response = await request<Breakdown>(`${base(owner)}/breakdown${pageQuery({
          ...params(owner, filter!), dimension: dimension!, page, size: PAGE_SIZE,
        })}`, { signal });
        rows.push(...(response.items ?? []));
        total = response.paging?.totalElements ?? rows.length;
        if (!response.paging?.hasNext) break;
      }
      return { rows, total };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Сколько строк в разрезе — для «Итого: 28 учителей», без загрузки самих строк. */
export function useReportDimensionTotal(owner: ReportOwner, filter: ReportFilter | null, dimension: ReportDimension | null) {
  return useQuery({
    queryKey: ['academic-reports', ...ownerKey(owner), 'breakdown-total', dimension, filter],
    enabled: filter != null && dimension != null,
    queryFn: async ({ signal }) => (await request<Breakdown>(`${base(owner)}/breakdown${pageQuery({
      ...params(owner, filter!), dimension: dimension!, page: 0, size: 1,
    })}`, { signal })).paging?.totalElements ?? 0,
    staleTime: 0,
  });
}

/** Опубликованные итоги среза — колонка «Итог за четверть» и итоги в шторке ученика. */
export function useReportFinals(owner: ReportOwner, filter: ReportFilter | null) {
  return useQuery({
    queryKey: ['academic-reports', ...ownerKey(owner), 'final-grades', filter],
    enabled: filter != null,
    queryFn: async ({ signal }) => {
      const items: NonNullable<FinalPage['items']> = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const response = await request<FinalPage>(`${base(owner)}/final-grades${pageQuery({
          ...params(owner, filter!), page, size: PAGE_SIZE,
        })}`, { signal });
        items.push(...(response.items ?? []));
        if (!response.paging?.hasNext) break;
      }
      return items;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/*
 * Справочники фильтров администратора. Без фильтра по статусу: отчётность читает и
 * прошлые годы, и архивные классы (academic-reporting-contract «Фильтры и доступ»).
 */

export function useReportYears() {
  return useQuery({
    queryKey: ['academic-reports', 'catalog', 'years'],
    queryFn: ({ signal }) => request<Schema<'PageAcademicYearView'>>(
      `/admin/academic-years${pageQuery({ page: 0, size: 100 })}`, { signal }),
    staleTime: 60_000,
  });
}

export function useReportPeriods(academicYearId: number | null) {
  return useQuery({
    queryKey: ['academic-reports', 'catalog', 'periods', academicYearId],
    enabled: academicYearId != null,
    queryFn: ({ signal }) => request<Schema<'AcademicPeriodView'>[]>(
      `/admin/academic-years/${academicYearId}/periods`, { signal }),
    staleTime: 60_000,
  });
}

export function useReportClasses(academicYearId: number | null) {
  return useQuery({
    queryKey: ['academic-reports', 'catalog', 'classes', academicYearId],
    enabled: academicYearId != null,
    queryFn: ({ signal }) => request<Schema<'PageSchoolClassView'>>(
      `/admin/classes${pageQuery({ academicYearId, page: 0, size: 300 })}`, { signal }),
    staleTime: 60_000,
  });
}

export function useReportSubjects() {
  return useQuery({
    queryKey: ['academic-reports', 'catalog', 'subjects'],
    queryFn: ({ signal }) => request<Schema<'PageSchoolSubjectView'>>(
      `/admin/school-subjects${pageQuery({ page: 0, size: 300 })}`, { signal }),
    staleTime: 60_000,
  });
}
