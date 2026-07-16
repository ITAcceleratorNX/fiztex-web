import { useMutation, useQuery, useQueryClient, useQueries } from '@tanstack/react-query';
import { subgroupsApi, type GroupSetListFilters } from '@/lib/schedule2bApi';
import type { AutoSplitRequest } from '@/lib/schedule2bTypes';
import { platformCoreApi } from '@/lib/platformCoreApi';

export const subgroupsKeys = {
  all: ['schedule-2b-subgroups'] as const,
  groupSets: (filters: GroupSetListFilters) =>
    [...subgroupsKeys.all, 'group-sets', filters] as const,
  /** Prefix: invalidate aggregate + unassigned together after membership mutations. */
  groupSetRoot: (setId: number) => [...subgroupsKeys.all, 'group-set', setId] as const,
  groupSet: (setId: number) => [...subgroupsKeys.groupSetRoot(setId), 'aggregate'] as const,
  unassigned: (setId: number) => [...subgroupsKeys.groupSetRoot(setId), 'unassigned'] as const,
  subjects: ['school-subjects', 'active'] as const,
  periods: (yearId: number) => ['academic-periods', yearId] as const,
};

export function useGroupSets(filters: GroupSetListFilters | null) {
  return useQuery({
    queryKey: subgroupsKeys.groupSets(filters ?? { classId: 0 }),
    queryFn: ({ signal }) => subgroupsApi.listGroupSets(filters!, signal),
    enabled: filters != null && filters.classId > 0,
  });
}

export function useGroupSetAggregate(setId: number | null) {
  return useQuery({
    queryKey: subgroupsKeys.groupSet(setId ?? 0),
    queryFn: ({ signal }) => subgroupsApi.getGroupSet(setId!, signal),
    enabled: setId != null && setId > 0,
  });
}

export function useUnassignedStudents(setId: number | null) {
  return useQuery({
    queryKey: subgroupsKeys.unassigned(setId ?? 0),
    queryFn: ({ signal }) => subgroupsApi.unassignedStudents(setId!, signal),
    enabled: setId != null && setId > 0,
  });
}

/** Count-only fetches for set-list badges (ТЗ §6.7). Prefer list DTO field later. */
export function useUnassignedCounts(setIds: number[]) {
  return useQueries({
    queries: setIds.map((setId) => ({
      queryKey: [...subgroupsKeys.unassigned(setId), 'count'] as const,
      queryFn: async ({ signal }: { signal?: AbortSignal }) => {
        const list = await subgroupsApi.unassignedStudents(setId, signal);
        return list.length;
      },
      enabled: setId > 0,
      staleTime: 60_000,
    })),
  });
}

export function useSchoolSubjects() {
  return useQuery({
    queryKey: subgroupsKeys.subjects,
    queryFn: ({ signal }) => platformCoreApi.listSubjects(signal),
  });
}

export function useAcademicPeriods(yearId: number | null) {
  return useQuery({
    queryKey: subgroupsKeys.periods(yearId ?? 0),
    queryFn: ({ signal }) => platformCoreApi.listPeriods(yearId!, signal),
    enabled: yearId != null && yearId > 0,
  });
}

function invalidateGroupSetAndList(
  queryClient: ReturnType<typeof useQueryClient>,
  setId: number,
) {
  void queryClient.invalidateQueries({ queryKey: subgroupsKeys.groupSetRoot(setId) });
  void queryClient.invalidateQueries({
    queryKey: [...subgroupsKeys.all, 'group-sets'],
  });
}

export function useCreateGroupSet(classId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      subjectId?: number | null;
      academicPeriodId?: number | null;
    }) => {
      if (classId == null) throw new Error('classId is required');
      return subgroupsApi.createGroupSet({ classId, ...body });
    },
    onSuccess: () => {
      if (classId != null) {
        void queryClient.invalidateQueries({
          queryKey: [...subgroupsKeys.all, 'group-sets'],
        });
      }
    },
  });
}

export function useArchiveGroupSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ setId, confirmImpact }: { setId: number; confirmImpact?: boolean }) =>
      subgroupsApi.archiveGroupSet(setId, confirmImpact ?? false),
    onSuccess: (_data, vars) => {
      invalidateGroupSetAndList(queryClient, vars.setId);
    },
  });
}

export function useCreateSubgroup(setId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => {
      if (setId == null) throw new Error('setId is required');
      return subgroupsApi.createSubgroup({ groupSetId: setId, name });
    },
    onSuccess: () => {
      if (setId != null) invalidateGroupSetAndList(queryClient, setId);
    },
  });
}

export function usePatchSubgroup(setId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ subgroupId, name }: { subgroupId: number; name: string }) =>
      subgroupsApi.patchSubgroup(subgroupId, { name }),
    onSuccess: () => {
      if (setId != null) invalidateGroupSetAndList(queryClient, setId);
    },
  });
}

export function useArchiveSubgroup(setId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      subgroupId,
      confirmImpact,
    }: {
      subgroupId: number;
      confirmImpact?: boolean;
    }) => subgroupsApi.archiveSubgroup(subgroupId, confirmImpact ?? false),
    onSuccess: () => {
      if (setId != null) invalidateGroupSetAndList(queryClient, setId);
    },
  });
}

export function useAutoSplit(setId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body?: AutoSplitRequest) => {
      if (setId == null) throw new Error('setId is required');
      return subgroupsApi.autoSplit(setId, body);
    },
    onSuccess: () => {
      if (setId != null) invalidateGroupSetAndList(queryClient, setId);
    },
  });
}

export function useAddSubgroupStudents(setId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ subgroupId, studentIds }: { subgroupId: number; studentIds: number[] }) =>
      subgroupsApi.addStudents(subgroupId, studentIds),
    onSuccess: () => {
      if (setId != null) invalidateGroupSetAndList(queryClient, setId);
    },
  });
}

export function useRemoveSubgroupStudent(setId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ subgroupId, studentId }: { subgroupId: number; studentId: number }) =>
      subgroupsApi.removeStudent(subgroupId, studentId),
    onSuccess: () => {
      if (setId != null) invalidateGroupSetAndList(queryClient, setId);
    },
  });
}

export function useMoveSubgroupStudent(setId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      subgroupId,
      studentId,
      targetSubgroupId,
    }: {
      subgroupId: number;
      studentId: number;
      targetSubgroupId: number;
    }) => subgroupsApi.moveStudent(subgroupId, studentId, targetSubgroupId),
    onSuccess: () => {
      if (setId != null) invalidateGroupSetAndList(queryClient, setId);
    },
  });
}
