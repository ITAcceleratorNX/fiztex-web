import { useQuery } from '@tanstack/react-query';
import { pageQuery, request, requestBlob } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

/**
 * Учебная отчётность: один набор запросов на три адреса.
 *
 * <p>Администратор читает `/api/admin/academic-reports/*` по всей школе; классный
 * руководитель — `/api/my-class/classes/{classId}/academic-reports/*` по своему классу;
 * учитель-предметник — `/api/teacher/academic-reports/*` по своим парам «класс × предмет».
 * Права решает сервер; клиент лишь не шлёт параметров, которых у владельца нет
 * (`classId` руководителю, `teacherProfileId` обоим учителям), — сервер отказал бы им
 * `FILTER_NOT_ALLOWED`.
 */
export type ReportOwner = { kind: 'admin' } | { kind: 'homeroom'; classId: number } | { kind: 'teacher' };

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
  if (owner.kind === 'admin') return '/admin/academic-reports';
  if (owner.kind === 'teacher') return '/teacher/academic-reports';
  return `/my-class/classes/${owner.classId}/academic-reports`;
}

function params(owner: ReportOwner, filter: ReportFilter): Record<string, number | undefined> {
  const admin = owner.kind === 'admin';
  return {
    academicYearId: filter.academicYearId,
    academicPeriodId: filter.academicPeriodId ?? undefined,
    classId: owner.kind === 'homeroom' ? undefined : filter.classId ?? undefined,
    subjectId: filter.subjectId ?? undefined,
    teacherProfileId: admin ? filter.teacherProfileId ?? undefined : undefined,
    studentProfileId: filter.studentProfileId ?? undefined,
  };
}

function ownerKey(owner: ReportOwner) {
  if (owner.kind === 'admin') return ['admin'] as const;
  if (owner.kind === 'teacher') return ['teacher'] as const;
  return ['homeroom', owner.classId] as const;
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

/**
 * Сводная успеваемость среза (ученик → предметы → ученики). Отдельным запросом от сводки:
 * сервер читает здесь строку на каждую пару «ученик × предмет».
 */
export function useReportPerformance(owner: ReportOwner, filter: ReportFilter | null) {
  return useQuery({
    queryKey: ['academic-reports', ...ownerKey(owner), 'performance', filter],
    enabled: filter != null,
    queryFn: ({ signal }) => request<Schema<'AcademicReportPerformanceResponse'>>(
      `${base(owner)}/performance${pageQuery(params(owner, filter!))}`, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Полный рейтинг учеников: места, порядок и полнота — с сервера. */
export function useStudentRating(owner: ReportOwner, filter: ReportFilter | null) {
  return useQuery({
    queryKey: ['academic-reports', ...ownerKey(owner), 'rating-students', filter],
    enabled: filter != null,
    queryFn: ({ signal }) => request<Schema<'AcademicReportStudentRatingView'>>(
      `${base(owner)}/ratings/students${pageQuery(params(owner, filter!))}`, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Сравнение классов; у классного руководителя его нет — запрос не уходит. */
export function useClassRating(owner: ReportOwner, filter: ReportFilter | null) {
  return useQuery({
    queryKey: ['academic-reports', ...ownerKey(owner), 'rating-classes', filter],
    enabled: filter != null && owner.kind !== 'homeroom',
    queryFn: ({ signal }) => request<Schema<'AcademicReportClassRatingView'>>(
      `${base(owner)}/ratings/classes${pageQuery({ ...params(owner, filter!), studentProfileId: undefined })}`, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Динамика по периодам года: период в запрос не идёт — точки и есть периоды. */
export function useReportDynamics(owner: ReportOwner, filter: ReportFilter | null) {
  const yearFilter = filter && { ...filter, academicPeriodId: null };
  return useQuery({
    queryKey: ['academic-reports', ...ownerKey(owner), 'dynamics', yearFilter],
    enabled: yearFilter != null,
    queryFn: ({ signal }) => request<Schema<'AcademicReportDynamicsView'>>(
      `${base(owner)}/dynamics${pageQuery(params(owner, yearFilter!))}`, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * Excel открытого отчёта. Файл собирает сервер по тем же фильтрам и правам, что экран;
 * ответ приходит только с `Authorization`, поэтому качается запросом, а не ссылкой.
 */
export async function downloadReportExcel(owner: ReportOwner, filter: ReportFilter, fileName: string): Promise<void> {
  const blob = await requestBlob(`${base(owner)}/export${pageQuery(params(owner, filter))}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Годы, периоды и пары «класс × предмет» учителя-предметника — всё, из чего он выбирает. */
export function useTeacherReportContext(academicYearId: number | null, reportKind?: string) {
  return useQuery({
    queryKey: ['academic-reports', 'teacher', 'context', academicYearId, reportKind],
    queryFn: ({ signal }) => request<Schema<'TeacherAcademicReportContextView'>>(
      `/teacher/academic-reports/${reportKind ? 'special-context' : 'context'}${pageQuery({
        academicYearId: academicYearId ?? undefined, reportKind,
      })}`, { signal }),
    staleTime: reportKind ? 0 : 60_000,
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
