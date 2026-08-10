import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { lessonsApi } from '@/lib/lessonsApi';
import { announcementsApi, type AnnouncementFilters, type AnnouncementRequest } from '@/lib/announcementsApi';
import type {
  ApplicantRequest,
  GenerateTestRequest,
  MaterialUpdateRequest,
  QuestionRequest,
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
  testsByGrade: (grade: string) => ['tests', 'grade', grade] as const,
  testQuestions: (id: number) => ['tests', id, 'questions'] as const,
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
  lesson: (lessonId: number) => ['lessons', lessonId] as const,
  lessonHistory: (lessonId: number) => ['lessons', lessonId, 'history'] as const,
  lessonStudents: (lessonId: number) => ['lessons', lessonId, 'students'] as const,
  // Анонсы: публичная витрина и админский список кэшируются раздельно — у них
  // разная видимость, и сброс админского списка не должен трогать публичный.
  announcements: (filters: AnnouncementFilters) =>
    ['announcements', 'admin', filters.status ?? '', filters.grade ?? '', filters.page ?? 0] as const,
  announcement: (id: number) => ['announcements', 'admin', id] as const,
  publicAnnouncements: (grade: string) => ['announcements', 'public', 'list', grade] as const,
  publicAnnouncementGrades: ['announcements', 'public', 'grades'] as const,
  publicAnnouncement: (id: number) => ['announcements', 'public', id] as const,
};

const ADMISSIONS_POLL_MS = 30_000;

// ---- Subjects (read-only; sourced from unified school subjects) ----
export function useSubjects() {
  return useQuery({ queryKey: keys.subjects, queryFn: ({ signal }) => api.listSubjects(signal) });
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

/** Тесты выбранного класса — шаг «выбор теста» в окне «Добавить из другого теста». */
export function useTestsByGrade(grade: string | null) {
  return useQuery({
    queryKey: grade ? keys.testsByGrade(grade) : ['tests', 'grade', 'none'],
    queryFn: ({ signal }) => api.listTests(undefined, signal, grade as string),
    enabled: Boolean(grade),
  });
}

export function useTestQuestions(testId: number | null) {
  return useQuery({
    queryKey: testId != null ? keys.testQuestions(testId) : ['tests', 'questions', 'none'],
    queryFn: ({ signal }) => api.listTestQuestions(testId as number, signal),
    enabled: testId != null,
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

export function useImportQuestions() {
  return useMutation({
    mutationFn: ({
      testId,
      formData,
      useAiReader,
    }: {
      testId: number;
      formData: FormData;
      useAiReader: boolean;
    }) => api.importQuestions(testId, formData, useAiReader),
  });
}

/** Вариант вопроса с AI. Ничего не сохраняет — результат уходит в предпросмотр. */
export function useAiQuestionVariant() {
  return useMutation({
    mutationFn: (question: QuestionRequest) => api.aiQuestionVariant(question),
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

// ---- Уроки (карточка урока) ----

/** 404 здесь — это «нет доступа к уроку» (ТЗ §6.12), а не сбой: повторять нечего. */
function isMissingLesson(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function useLesson(lessonId: number | null) {
  return useQuery({
    queryKey: keys.lesson(lessonId ?? 0),
    queryFn: ({ signal }) => lessonsApi.card(lessonId as number, signal),
    enabled: lessonId != null,
    retry: (failureCount, error) => !isMissingLesson(error) && failureCount < 2,
  });
}

/**
 * Журнал урока. Права на него бэкенд считает сам, поэтому запрос включается
 * только там, где карточка уже вернула соответствующую capability — иначе экран
 * ходил бы за гарантированным 403.
 */
export function useLessonHistory(lessonId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: keys.lessonHistory(lessonId ?? 0),
    queryFn: ({ signal }) => lessonsApi.history(lessonId as number, { size: 50 }, signal),
    enabled: lessonId != null && enabled,
  });
}

export function useLessonStudents(lessonId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: keys.lessonStudents(lessonId ?? 0),
    queryFn: ({ signal }) => lessonsApi.students(lessonId as number, signal),
    enabled: lessonId != null && enabled,
  });
}

// ---- Анонсы вступительных тестов ----

/**
 * Любая запись обесценивает и админский список, и публичную витрину: скрытый
 * анонс должен пропасть из публичного списка сразу, а не после перезагрузки.
 * Общий префикс `['announcements']` сбрасывает оба дерева одним вызовом.
 */
function invalidateAnnouncements(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['announcements'] });
}

export function useAnnouncements(filters: AnnouncementFilters) {
  return useQuery({
    queryKey: keys.announcements(filters),
    queryFn: ({ signal }) => announcementsApi.list(filters, signal),
    placeholderData: (previous) => previous,
  });
}

export function useAnnouncement(id: number | null) {
  return useQuery({
    queryKey: keys.announcement(id ?? 0),
    queryFn: ({ signal }) => announcementsApi.get(id as number, signal),
    enabled: id != null,
  });
}

/**
 * «Сохранить черновик» и «Сохранить и опубликовать» — одна мутация.
 *
 * Бэкенд держит создание и публикацию раздельно (у перехода свои правила), но
 * администратору это не интересно: он нажал одну кнопку. Последовательность
 * живёт здесь, а не в компоненте формы, чтобы её не пришлось повторять в каждом
 * месте, откуда анонс можно сохранить.
 */
export function useSaveAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      body,
      publish,
    }: {
      id?: number;
      body: AnnouncementRequest;
      publish?: boolean;
    }) => {
      const saved = id
        ? await announcementsApi.update(id, body)
        : await announcementsApi.create(body);
      // Повторная публикация опубликованного вернула бы 409 — это не ошибка
      // администратора, а просто «уже опубликован».
      if (publish && saved.status !== 'PUBLISHED') {
        return announcementsApi.publish(saved.id as number);
      }
      return saved;
    },
    onSuccess: () => invalidateAnnouncements(qc),
  });
}

export function usePublishAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => announcementsApi.publish(id),
    onSuccess: () => invalidateAnnouncements(qc),
  });
}

export function useHideAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => announcementsApi.hide(id),
    onSuccess: () => invalidateAnnouncements(qc),
  });
}

// ---- Публичная витрина анонсов (без авторизации) ----

export function usePublicAnnouncements(grade: string) {
  return useQuery({
    queryKey: keys.publicAnnouncements(grade),
    queryFn: ({ signal }) => announcementsApi.listPublic(grade || undefined, signal),
  });
}

export function usePublicAnnouncementGrades() {
  return useQuery({
    queryKey: keys.publicAnnouncementGrades,
    queryFn: ({ signal }) => announcementsApi.publicGrades(signal),
  });
}

/** 404 — «анонс скрыт или не существует» (§7), а не сбой сети: повторять нечего. */
export function usePublicAnnouncement(id: number | null) {
  return useQuery({
    queryKey: keys.publicAnnouncement(id ?? 0),
    queryFn: ({ signal }) => announcementsApi.getPublic(id as number, signal),
    enabled: id != null,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  });
}
