import { useQuery } from '@tanstack/react-query';
import { ApiError, pageQuery, request, requestBlob } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import type { ReportOwner } from './reportingQueries';

/**
 * Специальные формы отчётности (ТЗ «Специальные формы учебной отчётности»): «Анализ СОР и
 * СОЧ», «Успеваемость класса по предмету» и «Учителю по предмету». Те же три адреса
 * владельцев, что у остальной отчётности; числа и состояния строк
 * приходят готовыми — клиент ничего не считает. Контракт —
 * `fiztex-back/docs/special-report-forms-contract.md`.
 */

export type SpecialForm = 'assessment' | 'classPerformance' | 'teacherPerformance';
export type SpecialExportFormat = 'XLSX' | 'DOCX' | 'PDF';

export type AssessmentAnalysisReport = Schema<'AssessmentAnalysisReportView'>;
export type AssessmentAnalysisWork = Schema<'AssessmentAnalysisWorkView'>;
export type PerformanceFormReport = Schema<'PerformanceFormView'>;
export type PerformanceRow = Schema<'PerformanceRowView'>;

export interface SpecialReportFilter {
  academicYearId: number;
  academicPeriodId?: number | null;
  classId?: number | null;
  subgroupId?: number | null;
  subjectId?: number | null;
  /** Только у администратора; учителю сервер ответил бы FILTER_NOT_ALLOWED. */
  teacherProfileId?: number | null;
}

const PATHS: Record<SpecialForm, string> = {
  assessment: 'assessment-analysis',
  classPerformance: 'class-performance',
  teacherPerformance: 'teacher-performance',
};

/** Форматы файла: Word есть только у анализа СОР/СОЧ (форма приказа №130). */
export const EXPORT_FORMATS: Record<SpecialForm, SpecialExportFormat[]> = {
  assessment: ['XLSX', 'DOCX', 'PDF'],
  classPerformance: ['XLSX', 'PDF'],
  teacherPerformance: ['XLSX', 'PDF'],
};

const EXTENSIONS: Record<SpecialExportFormat, string> = { XLSX: 'xlsx', DOCX: 'docx', PDF: 'pdf' };

function base(owner: ReportOwner): string {
  if (owner.kind === 'admin') return '/admin/academic-reports';
  if (owner.kind === 'teacher') return '/teacher/academic-reports';
  return `/my-class/classes/${owner.classId}/academic-reports`;
}

export function specialReportParams(owner: ReportOwner, filter: SpecialReportFilter): Record<string, number | undefined> {
  return {
    academicYearId: filter.academicYearId,
    academicPeriodId: filter.academicPeriodId ?? undefined,
    classId: owner.kind === 'homeroom' ? undefined : filter.classId ?? undefined,
    subgroupId: filter.subgroupId ?? undefined,
    subjectId: filter.subjectId ?? undefined,
    teacherProfileId: owner.kind === 'admin' ? filter.teacherProfileId ?? undefined : undefined,
  };
}

function ownerKey(owner: ReportOwner) {
  return owner.kind === 'homeroom' ? ['homeroom', owner.classId] as const : [owner.kind] as const;
}

/** Форма как запрос: `filter = null` — запрос не уходит (не выбран год, учитель или предмет). */
export function useSpecialReport<F extends SpecialForm>(owner: ReportOwner, form: F, filter: SpecialReportFilter | null) {
  return useQuery({
    queryKey: ['special-reports', ...ownerKey(owner), form, filter],
    enabled: filter != null,
    queryFn: ({ signal }) => request<F extends 'assessment' ? AssessmentAnalysisReport : PerformanceFormReport>(
      `${base(owner)}/${PATHS[form]}${pageQuery(specialReportParams(owner, filter!))}`, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: (count, error) => !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && count < 2,
    gcTime: 0,
  });
}

/**
 * Файл формы собирает сервер из тех же агрегатов и с той же проверкой прав, что экран;
 * ответ приходит только с `Authorization`, поэтому качается запросом, а не ссылкой.
 */
export async function downloadSpecialReport(owner: ReportOwner, form: SpecialForm, filter: SpecialReportFilter,
  format: SpecialExportFormat, fileStem: string): Promise<void> {
  const blob = await requestBlob(`${base(owner)}/${PATHS[form]}/export${pageQuery({
    ...specialReportParams(owner, filter), format,
  })}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileStem}.${EXTENSIONS[format]}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
