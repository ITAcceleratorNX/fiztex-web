import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teacherAvailabilityApi } from '@/lib/schedule2bApi';
import { platformCoreApi } from '@/lib/platformCoreApi';
import type { PutAvailabilityRequest } from '@/lib/schedule2bTypes';

export const teacherAvailabilityKeys = {
  all: ['teacher-availability'] as const,
  detail: (teacherId: number) => [...teacherAvailabilityKeys.all, teacherId] as const,
  teachers: (name: string, page: number) => ['teachers', name, page] as const,
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
