import { pageQuery, request } from '@/lib/api';
import type { Page } from '@/lib/types';
import type { SubjectRef, TeacherRef } from '@/lib/schedule2bTypes';
import type {
  AcademicYearRef,
  GradeClassGroup,
  SchoolClassRef,
} from '@/lib/scheduleSettingsTypes';

/**
 * Minimal Core reads for schedule-settings selectors.
 * Does not touch platform mock services.
 */
export const platformCoreApi = {
  listAcademicYears: (signal?: AbortSignal) =>
    request<Page<AcademicYearRef>>(
      `/admin/academic-years${pageQuery({ page: 0, size: 100 })}`,
      { signal },
    ),

  listClasses: (academicYearId: number, signal?: AbortSignal) =>
    request<Page<SchoolClassRef>>(
      `/admin/classes${pageQuery({
        academicYearId,
        status: 'ACTIVE',
        page: 0,
        size: 200,
      })}`,
      { signal },
    ),

  listTeachers: (params: { name?: string; page?: number; size?: number } = {}, signal?: AbortSignal) =>
    request<Page<TeacherRef>>(
      `/admin/teachers${pageQuery({
        name: params.name || undefined,
        page: params.page ?? 0,
        size: params.size ?? 20,
      })}`,
      { signal },
    ),

  listSubjects: (signal?: AbortSignal) =>
    request<Page<SubjectRef>>(
      `/admin/school-subjects${pageQuery({
        status: 'ACTIVE',
        page: 0,
        size: 200,
      })}`,
      { signal },
    ),
};

/** Group active classes by grade for bindings / calendar target pickers. */
export function groupClassesByGrade(classes: SchoolClassRef[]): GradeClassGroup[] {
  const byGrade = new Map<string, SchoolClassRef[]>();
  for (const schoolClass of classes) {
    const list = byGrade.get(schoolClass.grade) ?? [];
    list.push(schoolClass);
    byGrade.set(schoolClass.grade, list);
  }
  return [...byGrade.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ru', { numeric: true }))
    .map(([grade, group]) => ({
      grade,
      classes: [...group].sort((a, b) => a.letter.localeCompare(b.letter, 'ru')),
    }));
}
