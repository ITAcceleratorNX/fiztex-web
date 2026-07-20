import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  ApplicantRequest,
  GenerateTestRequest,
  MaterialUpdateRequest,
  SubjectRequest,
  TestRequest,
} from '@/lib/types';

export const keys = {
  subjects: ['subjects'] as const,
  tests: (useAiGeneration?: boolean) =>
    useAiGeneration === true
      ? (['tests', 'ai'] as const)
      : useAiGeneration === false
        ? (['tests', 'admission'] as const)
        : (['tests', 'all'] as const),
  test: (id: number) => ['tests', id] as const,
  applicants: ['applicants'] as const,
  reviews: ['reviews'] as const,
  resultsPage: (status: string, search: string, page: number, size: number) =>
    ['results', 'page', status, search, page, size] as const,
  materials: (subjectId: number) => ['materials', subjectId] as const,
  generationJob: (id: number) => ['generation-jobs', id] as const,
  generationJobs: (testId: number) => ['tests', testId, 'generation-jobs'] as const,
  admissionsUnreadCount: ['admissions', 'notifications', 'unread-count'] as const,
  admissionsNotifications: (unread?: boolean) => ['admissions', 'notifications', 'list', unread] as const,
  monitoringAttempts: (status?: string) => ['admissions', 'attempts', status ?? 'ALL'] as const,
  attemptLogs: (attemptId: number) => ['admissions', 'attempts', attemptId, 'logs'] as const,
};

const ADMISSIONS_POLL_MS = 30_000;

// ---- Subjects ----
export function useSubjects() {
  return useQuery({ queryKey: keys.subjects, queryFn: ({ signal }) => api.listSubjects(signal) });
}

export function useCreateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubjectRequest) => api.createSubject(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.subjects }),
  });
}

export function useUpdateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: SubjectRequest }) => api.updateSubject(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.subjects });
      qc.invalidateQueries({ queryKey: ['tests'] });
    },
  });
}

// ---- Tests ----
export function useTests(useAiGeneration?: boolean) {
  return useQuery({
    queryKey: keys.tests(useAiGeneration),
    queryFn: ({ signal }) => api.listTests(useAiGeneration, signal),
  });
}

export function useTest(id: number | null) {
  return useQuery({
    queryKey: id ? keys.test(id) : ['tests', 'none'],
    queryFn: ({ signal }) => api.getTest(id as number, signal),
    enabled: id != null,
  });
}

export function useCreateTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TestRequest) => api.createTest(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tests'] });
      qc.invalidateQueries({ queryKey: keys.subjects });
    },
  });
}

export function useUpdateTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: TestRequest }) => api.updateTest(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['tests'] });
      qc.invalidateQueries({ queryKey: keys.test(vars.id) });
    },
  });
}

export function useDeleteTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteTest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tests'] });
      qc.invalidateQueries({ queryKey: keys.subjects });
    },
  });
}

export function useAssignTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, applicantIds }: { id: number; applicantIds: number[] }) =>
      api.assignTest(id, applicantIds),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['tests'] });
      qc.invalidateQueries({ queryKey: keys.test(vars.id) });
      qc.invalidateQueries({ queryKey: keys.applicants });
    },
  });
}

export function useChangeAssignmentVersion(testId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, versionNumber }: { assignmentId: number; versionNumber: number }) =>
      api.changeAssignmentVersion(testId, assignmentId, versionNumber),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tests'] });
      qc.invalidateQueries({ queryKey: keys.test(testId) });
      qc.invalidateQueries({ queryKey: keys.applicants });
    },
  });
}

// ---- Review / results ----
export function useResultsPage(status: string, search: string, page: number, size: number) {
  return useQuery({
    queryKey: keys.resultsPage(status, search, page, size),
    queryFn: ({ signal }) =>
      api.listResultsPage(
        {
          status: status === 'ALL' ? undefined : status,
          search: search.trim() || undefined,
          page,
          size,
        },
        signal,
      ),
  });
}

// ---- Applicants ----
export function useApplicants() {
  return useQuery({ queryKey: keys.applicants, queryFn: ({ signal }) => api.listApplicants(signal) });
}

export function useCreateApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApplicantRequest) => api.createApplicant(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.applicants }),
  });
}

export function useUpdateApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ApplicantRequest }) => api.updateApplicant(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.applicants }),
  });
}

// ---- Materials ----
export function useMaterials(subjectId: number) {
  return useQuery({
    queryKey: keys.materials(subjectId),
    queryFn: ({ signal }) => api.listMaterials(subjectId, signal),
    refetchInterval: (query) => {
      const materials = query.state.data;
      if (materials?.some((m) => m.status === 'EXTRACTING' || m.status === 'UPLOADED')) {
        return 3000;
      }
      return false;
    },
  });
}

export function useUploadMaterial(subjectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => api.uploadMaterial(formData),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.materials(subjectId) }),
  });
}

export function useUpdateMaterial(subjectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: MaterialUpdateRequest }) =>
      api.updateMaterial(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.materials(subjectId) }),
  });
}

export function useDeleteMaterial(subjectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteMaterial(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.materials(subjectId) }),
  });
}

export function useRetryMaterialExtract(subjectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.retryMaterialExtract(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.materials(subjectId) }),
  });
}

// ---- Test generation ----
export function useGenerateTest() {
  return useMutation({
    mutationFn: ({ testId, body }: { testId: number; body: GenerateTestRequest }) =>
      api.generateTest(testId, body),
  });
}

export function useGenerationJob(jobId: number | null) {
  return useQuery({
    queryKey: jobId ? keys.generationJob(jobId) : ['generation-jobs', 'none'],
    queryFn: ({ signal }) => api.getGenerationJob(jobId as number, signal),
    enabled: jobId != null,
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!job) return 4000;
      if (job.status === 'PENDING' || job.status === 'RUNNING') return 4000;
      return false;
    },
  });
}

export function useGenerationJobs(testId: number | null) {
  return useQuery({
    queryKey: testId != null ? keys.generationJobs(testId) : ['generation-jobs', 'list', 'none'],
    queryFn: ({ signal }) => api.listGenerationJobs(testId as number, signal),
    enabled: testId != null,
  });
}

// ---- Admissions admin (monitoring & notifications) ----

export function useAdmissionsUnreadCount() {
  return useQuery({
    queryKey: keys.admissionsUnreadCount,
    queryFn: ({ signal }) => api.getAdmissionsUnreadCount(signal),
    refetchInterval: ADMISSIONS_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useAdmissionsNotifications(unread?: boolean) {
  return useQuery({
    queryKey: keys.admissionsNotifications(unread),
    queryFn: ({ signal }) => api.listAdmissionsNotifications({ unread, page: 0, size: 15 }, signal),
    refetchInterval: ADMISSIONS_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.markAdmissionsNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admissions', 'notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllAdmissionsNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admissions', 'notifications'] });
    },
  });
}

export function useMonitoringAttempts(status?: string) {
  return useInfiniteQuery({
    queryKey: keys.monitoringAttempts(status),
    queryFn: ({ pageParam = 0, signal }) =>
      api.listMonitoringAttempts(
        { status: status === 'ALL' ? undefined : status, page: pageParam, size: 50 },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.number + 1 < last.totalPages ? last.number + 1 : undefined,
    refetchInterval: ADMISSIONS_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useAttemptLogs(attemptId: number | null) {
  return useInfiniteQuery({
    queryKey: keys.attemptLogs(attemptId ?? 0),
    queryFn: ({ pageParam = 0, signal }) =>
      api.getAttemptLogs(attemptId as number, pageParam, 20, signal),
    enabled: attemptId != null,
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.number + 1 < last.totalPages ? last.number + 1 : undefined,
  });
}

export function useAllowRetake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: number) => api.allowRetake(assignmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admissions', 'attempts'] });
    },
  });
}
