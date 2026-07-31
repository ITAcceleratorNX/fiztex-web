import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teacherAvailabilityApi } from '@/lib/schedule2bApi';
import { platformCoreApi } from '@/lib/platformCoreApi';
import type { PutAvailabilityRequest, TeacherAvailabilityState } from '@/lib/schedule2bTypes';

export const teacherAvailabilityKeys = {
  all: ['teacher-availability'] as const,
  detail: (teacherId: number) => [...teacherAvailabilityKeys.all, teacherId] as const,
  teachers: (name: string, page: number) => ['teachers', name, page] as const,
  summaries: (yearId: number, name: string, availability: TeacherAvailabilityState | null, page: number) =>
    [...teacherAvailabilityKeys.all, 'summaries', yearId, name, availability, page] as const,
  summary: (teacherId: number, yearId: number) =>
    [...teacherAvailabilityKeys.all, 'summary', teacherId, yearId] as const,
};

export function useTeacherAvailability(teacherId: number | null) {
  return useQuery({
    queryKey: teacherAvailabilityKeys.detail(teacherId ?? 0),
    queryFn: ({ signal }) => teacherAvailabilityApi.get(teacherId!, signal),
    enabled: teacherId != null && teacherId > 0,
  });
}

export function useTeachersList(name: string, page: number) {
  return useQuery({
    queryKey: teacherAvailabilityKeys.teachers(name, page),
    queryFn: ({ signal }) =>
      platformCoreApi.listTeachers({ name: name || undefined, page, size: 20 }, signal),
  });
}

/**
 * Teachers for the «Занятость учителей» screen: subjects and availability state
 * arrive with the page, so rows need no per-teacher GETs.
 */
export function useTeacherAvailabilitySummaries(
  yearId: number | null,
  name: string,
  availability: TeacherAvailabilityState | null,
  page: number,
) {
  return useQuery({
    queryKey: teacherAvailabilityKeys.summaries(yearId ?? 0, name, availability, page),
    queryFn: ({ signal }) =>
      teacherAvailabilityApi.listSummaries(
        {
          academicYearId: yearId!,
          name: name || undefined,
          availability: availability ?? undefined,
          page,
          size: 20,
        },
        signal,
      ),
    enabled: yearId != null,
    // Rows carry the availability badge — keep the previous page visible while
    // paging or typing instead of collapsing the list to a spinner.
    placeholderData: (previous) => previous,
  });
}

/** Один учитель по id — для deep-link, когда его нет на текущей странице списка. */
export function useTeacherAvailabilitySummary(
  teacherId: number | null,
  yearId: number | null,
  enabled = true,
) {
  return useQuery({
    queryKey: teacherAvailabilityKeys.summary(teacherId ?? 0, yearId ?? 0),
    queryFn: ({ signal }) => teacherAvailabilityApi.getSummary(teacherId!, yearId!, signal),
    enabled: enabled && teacherId != null && teacherId > 0 && yearId != null,
  });
}

export function useSaveTeacherAvailability(teacherId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PutAvailabilityRequest) => {
      if (teacherId == null) throw new Error('teacherId is required');
      return teacherAvailabilityApi.put(teacherId, body);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: teacherAvailabilityKeys.detail(data.teacherId),
      });
    },
  });
}
