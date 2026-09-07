import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { myAvailabilityApi, teacherAvailabilityApi } from '@/lib/schedule2bApi';
import { platformCoreApi } from '@/lib/platformCoreApi';
import type {
  MyTeacherAvailability,
  PutAvailabilityRequest,
  SubmitAvailabilityProposalRequest,
  TeacherAvailabilityState,
} from '@/lib/schedule2bTypes';

export const teacherAvailabilityKeys = {
  all: ['teacher-availability'] as const,
  detail: (teacherId: number) => [...teacherAvailabilityKeys.all, teacherId] as const,
  teachers: (name: string, page: number) => ['teachers', name, page] as const,
  summaries: (
    yearId: number,
    name: string,
    availability: TeacherAvailabilityState | null,
    pendingOnly: boolean,
    page: number,
  ) =>
    [...teacherAvailabilityKeys.all, 'summaries', yearId, name, availability, pendingOnly, page] as const,
  summary: (teacherId: number, yearId: number) =>
    [...teacherAvailabilityKeys.all, 'summary', teacherId, yearId] as const,
  mine: () => [...teacherAvailabilityKeys.all, 'mine'] as const,
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
  pendingOnly: boolean,
  page: number,
) {
  return useQuery({
    queryKey: teacherAvailabilityKeys.summaries(yearId ?? 0, name, availability, pendingOnly, page),
    queryFn: ({ signal }) =>
      teacherAvailabilityApi.listSummaries(
        {
          academicYearId: yearId!,
          name: name || undefined,
          availability: availability ?? undefined,
          pendingProposal: pendingOnly ? true : undefined,
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

/**
 * Своё рабочее время учителя. Ключ без id: эндпоинт и так отвечает про того,
 * чей токен, — второго учителя в этом кэше быть не может.
 */
export function useMyAvailability() {
  return useQuery({
    queryKey: teacherAvailabilityKeys.mine(),
    queryFn: ({ signal }) => myAvailabilityApi.get(signal),
  });
}

export function useSubmitAvailabilityProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitAvailabilityProposalRequest) => myAvailabilityApi.submit(body),
    onSuccess: (data) => queryClient.setQueryData(teacherAvailabilityKeys.mine(), data),
  });
}

export function useWithdrawAvailabilityProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => myAvailabilityApi.withdraw(),
    onSuccess: (data: MyTeacherAvailability) =>
      queryClient.setQueryData(teacherAvailabilityKeys.mine(), data),
  });
}

/**
 * Решение админа по заявке. Списки перечитываются целиком: утверждение меняет и
 * занятость учителя, и его строку в сводке — досчитывать это на клиенте значило бы
 * держать вторую версию тех же правил.
 */
export function useDecideAvailabilityProposal(teacherId: number | null) {
  const queryClient = useQueryClient();

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: teacherAvailabilityKeys.all });
  }

  const approve = useMutation({
    mutationFn: () => {
      if (teacherId == null) throw new Error('teacherId is required');
      return teacherAvailabilityApi.approveProposal(teacherId);
    },
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: (comment: string | null) => {
      if (teacherId == null) throw new Error('teacherId is required');
      return teacherAvailabilityApi.rejectProposal(teacherId, comment);
    },
    onSuccess: invalidate,
  });

  return { approve, reject };
}
