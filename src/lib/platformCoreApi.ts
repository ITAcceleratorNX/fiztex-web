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

  /**
   * Учителя школы одним списком — для селекта-фильтра.
   *
   * Размер страницы взят с запасом на школу: постраничный выбор в фильтре означал бы,
   * что нужного человека не видно, пока не угадаешь страницу. Поиск по имени тут не
   * нужен — список короткий и целиком помещается в выпадающий.
   */
  listAllTeachers: (signal?: AbortSignal) =>
    request<Page<TeacherRef>>(
      `/admin/teachers${pageQuery({ page: 0, size: 300 })}`,
      { signal },
    ),

  /**
   * Ученики класса. Год обязателен вместе с классом: состав класса — это членство в
   * конкретном учебном году, и без него сервер вернул бы учеников всех лет сразу.
   */
  listClassStudents: (academicYearId: number, classId: number, signal?: AbortSignal) =>
    request<Page<StudentRef>>(
      `/admin/students${pageQuery({
        academicYearId,
        classId,
        status: 'ACTIVE',
        page: 0,
        size: 300,
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

  listPeriods: (academicYearId: number, signal?: AbortSignal) =>
    request<AcademicPeriodRef[]>(`/admin/academic-years/${academicYearId}/periods`, {
      signal,
    }),
};

export type StudentRef = {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  status: string;
};

export type AcademicPeriodRef = {
  id: number;
  academicYearId: number;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
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
