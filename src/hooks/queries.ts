import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, type CopyTestRequest } from '@/lib/api';
import {
  lessonAdminApi,
  lessonTeachingApi,
  lessonsApi,
  substitutionApi,
  type Lesson,
} from '@/lib/lessonsApi';
import { homeworkApi, type Homework } from '@/lib/homeworkApi';
import {
  homeworkAiApi,
  homeworkAnswersApi,
  homeworkQuestionsApi,
  lessonMaterialsApi,
  type SaveQuestionsRequest,
  type SetAnswerScoresRequest,
  type StartGenerationRequest,
} from '@/lib/homeworkAiApi';
import {
  attendanceApi,
  type AttendanceEntryChange,
  type AttendanceSheet,
} from '@/lib/attendanceApi';
import { attendanceQrApi, type AttendanceQrSession } from '@/lib/attendanceQrApi';
import { gradesApi, type GradeType } from '@/lib/gradesApi';
import {
  finalGradesApi,
  gradebookApi,
  type JournalQuery,
} from '@/lib/gradebookApi';
import { announcementsApi, type AnnouncementFilters, type AnnouncementRequest } from '@/lib/announcementsApi';
import {
  SECTION_STATUSES,
  meApi,
  serviceRequestsApi,
  type CreateServiceRequestInput,
  type ServiceSection,
} from '@/lib/serviceRequestsApi';
import {
  ADMIN_PAGE_SIZE,
  AUDIT_PAGE_SIZE,
  EMPTY_REQUESTS_FILTER,
  serviceRequestsAdminApi,
  type AllRequestsFilter,
  type AuditFilter,
} from '@/lib/serviceRequestsAdminApi';
import { byRecency } from '@/lib/serviceRequestsModel';
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
  lessonGradePermission: (lessonId: number) =>
    ['lessons', lessonId, 'substitution', 'grade-permission'] as const,
  lessonStudents: (lessonId: number) => ['lessons', lessonId, 'students'] as const,
  attendanceSheet: (lessonId: number) => ['lessons', lessonId, 'attendance'] as const,
  // Ключ живёт в пространстве 'homework': любое действие с заданием сбрасывает
  // весь раздел одним `invalidateQueries(['homework'])`, и список урока обязан
  // обновляться вместе с ним, а не жить своей жизнью под ключом урока.
  lessonHomework: (lessonId: number) => ['homework', 'lesson', lessonId, 'all'] as const,
  attendanceHistory: (lessonId: number) => ['lessons', lessonId, 'attendance', 'history'] as const,
  attendanceQr: (lessonId: number) => ['lessons', lessonId, 'attendance', 'qr'] as const,
  // Оценки урока: лист лежит под уроком, справочник шкалы — сам по себе, он общий
  // для всех экранов и не зависит ни от урока, ни от роли.
  lessonGradeSheet: (lessonId: number) => ['lessons', lessonId, 'grades', 'sheet'] as const,
  homeworkGrades: (homeworkId: number) => ['homework', homeworkId, 'grades'] as const,
  homeworkQuestions: (homeworkId: number) => ['homework', homeworkId, 'questions'] as const,
  homeworkMyQuestions: (homeworkId: number) => ['homework', homeworkId, 'my-questions'] as const,
  homeworkAnswers: (homeworkId: number, studentProfileId: number) =>
    ['homework', homeworkId, 'answers', studentProfileId] as const,
  homeworkAiJob: (jobId: number) => ['homework', 'ai-generations', jobId] as const,
  homeworkAiJobs: (homeworkId: number) => ['homework', homeworkId, 'ai-generations'] as const,
  homeworkAiQuota: ['homework', 'ai-quota'] as const,
  lessonMaterials: (lessonId: number, childId?: number) =>
    ['lessons', lessonId, 'materials', childId ?? 'self'] as const,
  // Одно пространство на весь раздел: создание, отмена и возврат меняют оба списка
  // сразу — заявка уходит из «Моих» в «Историю», — и сбрасывать их порознь значило бы
  // однажды забыть половину.
  myProfile: ['me', 'profile'] as const,
  serviceRequests: (section: ServiceSection) => ['service-requests', 'list', section] as const,
  serviceRequest: (id: number) => ['service-requests', id] as const,
  serviceRequestHistory: (id: number) => ['service-requests', id, 'history'] as const,
  // Разделы Super Admin живут в том же пространстве 'service-requests': отмена своей
  // заявки меняет и «Все заявки», и журнал, и сбрасывать их порознь значило бы однажды
  // забыть половину.
  allServiceRequests: (filter: AllRequestsFilter, page: number) =>
    ['service-requests', 'admin', 'all', filter, page] as const,
  serviceAudit: (filter: AuditFilter, page: number) =>
    ['service-requests', 'admin', 'audit', filter, page] as const,
  assignedServiceRequests: (accountId: number) =>
    ['service-requests', 'admin', 'assigned', accountId] as const,
  gradeScale: ['grades', 'scale'] as const,
  // Журнал и итоги живут под общим префиксом 'gradebook': любая правка оценки
  // сбрасывает всё дерево одним вызовом — та же оценка стоит и в журнале, и в
  // среднем, из которого считается рекомендация итоговой.
  gradebookContext: ['gradebook', 'context'] as const,
  journal: (query: JournalQuery) =>
    [
      'gradebook',
      'journal',
      query.classId,
      query.subjectId,
      query.academicPeriodId,
      query.subgroupId ?? null,
      query.dateFrom ?? null,
      query.dateTo ?? null,
    ] as const,
  classFinals: (query: Omit<JournalQuery, 'dateFrom' | 'dateTo'>) =>
    [
      'gradebook',
      'final-grades',
      query.classId,
      query.subjectId,
      query.academicPeriodId,
      query.subgroupId ?? null,
    ] as const,
  // Ключ по слоту, а не по уроку: у всех дат одного занятия список общий, и при
  // переходе между датами он не перезапрашивается.
  lessonOccurrences: (scheduleLessonId: number) =>
    ['schedule-slots', scheduleLessonId, 'lessons'] as const,
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

/** Копия AI-теста во вступительные. Списки обеих вкладок живут под ключом `tests` — сбрасываем оба. */
export function useCopyTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: CopyTestRequest }) => api.copyTest(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tests'] });
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

/**
 * Рисунок вопроса. Инвалидируется карточка теста: `imageUrl` живёт в вопросе, и без этого
 * редактор показывал бы старую картинку до перезагрузки страницы.
 */
export function useUploadQuestionImage(testId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, formData }: { questionId: number; formData: FormData }) =>
      api.uploadQuestionImage(questionId, formData),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.test(testId) }),
  });
}

export function useDeleteQuestionImage(testId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: number) => api.deleteQuestionImage(questionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.test(testId) }),
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

/**
 * Домашние задания урока — обе вкладки сразу.
 *
 * Вкладок у карточки урока нет и быть не должно: завершённое и отменённое задание для
 * урока такая же часть картины «что было задано», как актуальное. Вкладки принадлежат
 * ленте учителя (HOMEWORK-005.1 §4.1), а здесь список короткий и целиком про один урок.
 *
 * Включается там, где карточка урока уже вернула `VIEW_STUDENTS`: этим правом бэкенд
 * отличает того, кто видит урок «изнутри» (администратор и оба учителя), от участника —
 * у ученика и родителя своя лента заданий, и здесь их ждал бы гарантированный 403.
 */
export function useLessonHomework(lessonId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: keys.lessonHomework(lessonId ?? 0),
    queryFn: async ({ signal }): Promise<Homework[]> => {
      const [actual, history] = await Promise.all([
        homeworkApi.list({ scope: 'ACTUAL', lessonId: lessonId as number, size: 100 }, signal),
        homeworkApi.list({ scope: 'HISTORY', lessonId: lessonId as number, size: 100 }, signal),
      ]);
      return [...(actual.content ?? []), ...(history.content ?? [])];
    },
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

/**
 * Разовые изменения урока: замена и отмена.
 *
 * Ответ каждой команды — карточка целиком, поэтому она кладётся в кэш напрямую.
 * Инвалидировать `keys.lesson` при этом нельзя: он префикс ключей посещаемости,
 * истории и разрешения, и общий сброс тут же перезапросил бы то, что мы положили.
 * Поэтому зависимые ключи перечислены поимённо — каждый со своей причиной.
 */
function useLessonCommand<TVars>(
  lessonId: number,
  mutationFn: (vars: TVars) => Promise<Lesson>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (lesson) => {
      qc.setQueryData(keys.lesson(lessonId), lesson);
      // Отмена гасит витрину посещаемости, восстановление возвращает её черновиком.
      qc.invalidateQueries({ queryKey: keys.attendanceSheet(lessonId) });
      // Смена ведущего меняет `writeState` листа оценок — кнопки должны погаснуть.
      qc.invalidateQueries({ queryKey: keys.lessonGradeSheet(lessonId) });
      // Новое назначение всегда начинается без права на оценки (GRADES-002 §12).
      qc.invalidateQueries({ queryKey: keys.lessonGradePermission(lessonId) });
      qc.invalidateQueries({ queryKey: keys.lessonHistory(lessonId) });
    },
  });
}

export function useCancelLesson(lessonId: number) {
  return useLessonCommand(lessonId, (vars: { comment?: string }) =>
    lessonAdminApi.cancel(lessonId, vars),
  );
}

export function useRestoreLesson(lessonId: number) {
  return useLessonCommand(lessonId, () => lessonAdminApi.restore(lessonId));
}

export function useAssignSubstitute(lessonId: number) {
  return useLessonCommand(lessonId, (vars: { teacherProfileId: number; reason?: string }) =>
    lessonAdminApi.assignSubstitute(lessonId, vars),
  );
}

export function useRemoveSubstitute(lessonId: number) {
  return useLessonCommand(lessonId, () => lessonAdminApi.removeSubstitute(lessonId));
}

/**
 * Разрешение замещающему работать с оценками. Спрашивается только при действующей
 * замене: без неё бэкенд отвечает 409 `GRADE_PERMISSION_NO_SUBSTITUTION`, и ходить
 * за гарантированной ошибкой ради выключенного переключателя незачем.
 */
/**
 * Тема и комментарий урока. Ответ темы — карточка целиком, ответ комментария — только
 * он сам, поэтому карточку после него перезапрашиваем: в ней лежит `comment` с автором
 * и временем правки, собирать который на клиенте значило бы разойтись с сервером.
 */
export function useSaveLessonTopic(lessonId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (topic: string) =>
      topic.trim()
        ? lessonTeachingApi.setTopic(lessonId, topic.trim())
        : lessonTeachingApi.clearTopic(lessonId),
    onSuccess: (lesson) => {
      qc.setQueryData(keys.lesson(lessonId), lesson);
      qc.invalidateQueries({ queryKey: keys.lessonHistory(lessonId) });
    },
  });
}

export function useSaveLessonComment(lessonId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      if (body.trim()) await lessonTeachingApi.setComment(lessonId, body.trim());
      else await lessonTeachingApi.clearComment(lessonId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.lesson(lessonId) });
      qc.invalidateQueries({ queryKey: keys.lessonHistory(lessonId) });
    },
  });
}

/**
 * Отметка «ДЗ не задано» и её отмена.
 *
 * Ответ — карточка целиком, поэтому она кладётся в кэш, а не перезапрашивается: в ней
 * лежит `homeworkState`, посчитанный по всем заданиям урока.
 *
 * Список заданий урока при этом сбрасывается: отметку снимает публикация задания, и
 * после неё блок обязан показать и новое состояние, и само задание. `keys.lesson`
 * общим сбросом не трогаем — он префикс ключей посещаемости, истории и оценок.
 */
export function useSetHomeworkNotAssigned(lessonId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notAssigned: boolean) =>
      notAssigned
        ? lessonTeachingApi.markHomeworkNotAssigned(lessonId)
        : lessonTeachingApi.clearHomeworkNotAssigned(lessonId),
    onSuccess: (lesson) => {
      qc.setQueryData(keys.lesson(lessonId), lesson);
      qc.invalidateQueries({ queryKey: keys.lessonHomework(lessonId) });
      qc.invalidateQueries({ queryKey: keys.lessonHistory(lessonId) });
    },
  });
}

export function useGradePermission(lessonId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: keys.lessonGradePermission(lessonId ?? 0),
    queryFn: ({ signal }) => substitutionApi.gradePermission(lessonId as number, signal),
    enabled: lessonId != null && enabled,
  });
}

export function useSetGradePermission(lessonId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (canManageGrades: boolean) =>
      substitutionApi.setGradePermission(lessonId, canManageGrades),
    onSuccess: (permission) => {
      qc.setQueryData(keys.lessonGradePermission(lessonId), permission);
      // Право писать оценки у замещающего меняется — лист урока об этом знает.
      qc.invalidateQueries({ queryKey: keys.lessonGradeSheet(lessonId) });
      qc.invalidateQueries({ queryKey: keys.lessonHistory(lessonId) });
    },
  });
}

/**
 * Все даты одного занятия — уроки, порождённые тем же слотом расписания.
 *
 * Без диапазона дат: горизонт генерации и учебный год ограничивают выборку сами, а
 * любое окно вроде «±два месяца» пришлось бы придумывать — и оно всё равно обрезало
 * бы кому-нибудь нужную дату. Отбор идёт по физическому слоту (класс, подгруппа,
 * день недели, время), поэтому переживает переиздание расписания с новыми id строк.
 */
export function useLessonOccurrences(scheduleLessonId: number | null | undefined) {
  return useQuery({
    queryKey: keys.lessonOccurrences(scheduleLessonId ?? 0),
    queryFn: ({ signal }) =>
      lessonsApi.list({ scheduleLessonId: scheduleLessonId as number, size: 200 }, signal),
    enabled: scheduleLessonId != null,
  });
}

// ---- Посещаемость урока ----

/**
 * Лист посещаемости. Включается только там, где карточка урока уже вернула
 * `VIEW_ATTENDANCE`: без неё бэкенд ответит 403, и ходить за гарантированной
 * ошибкой ради выключенной плитки незачем.
 *
 * Не переспрашивается при возврате фокуса: лист правят несколько человек, но
 * подменять его под руками у того, кто сейчас расставляет отметки, — худшее из
 * возможных решений. Расхождение ловит `expectedVersion`, и о нём говорят прямо.
 */
export function useAttendanceSheet(lessonId: number | null, enabled = true) {
  return useQuery({
    queryKey: keys.attendanceSheet(lessonId ?? 0),
    queryFn: ({ signal }) => attendanceApi.sheet(lessonId as number, signal),
    enabled: lessonId != null && enabled,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && (error.status === 403 || error.status === 404)) &&
      failureCount < 2,
  });
}

/**
 * Состояние QR-кода урока: можно ли открыть, показан ли сейчас и кто уже отсканировал.
 *
 * <b>Ошибка этого запроса не должна ломать посещаемость</b> (ТЗ FE-001 §6): QR —
 * надстройка над листом, и недоступный код означает лишь отсутствие кнопки, а не
 * сломанный журнал. Поэтому вызывающий читает `data`, а не `error`.
 *
 * Как и лист, не переспрашивается при возврате фокуса: подменять показанный классу код
 * из-за переключения вкладки нельзя.
 */
export function useAttendanceQr(lessonId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: keys.attendanceQr(lessonId ?? 0),
    queryFn: ({ signal }) => attendanceQrApi.state(lessonId as number, signal),
    enabled: lessonId != null && enabled,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Открыть, перевыпустить и закрыть код. Ответ команды — то же представление, что отдаёт
 * `GET`, поэтому он кладётся в кэш напрямую: второй запрос показал бы на секунду
 * прежнее состояние.
 *
 * Лист при этом <b>не</b> сбрасывается. Открытие кода отметок не меняет, а сканы ученик
 * приносит сам — и версию листа они намеренно не двигают
 * (`fiztex-back/docs/attendance-qr-contract.md` §6).
 */
function useAttendanceQrCommand(
  lessonId: number,
  mutationFn: (id: number) => Promise<AttendanceQrSession>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => mutationFn(lessonId),
    onSuccess: (session) => {
      qc.setQueryData(keys.attendanceQr(lessonId), session);
    },
  });
}

export function useOpenAttendanceQr(lessonId: number) {
  return useAttendanceQrCommand(lessonId, attendanceQrApi.open);
}

export function useCloseAttendanceQr(lessonId: number) {
  return useAttendanceQrCommand(lessonId, attendanceQrApi.close);
}

export function useAttendanceHistory(lessonId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: keys.attendanceHistory(lessonId ?? 0),
    queryFn: ({ signal }) => attendanceApi.history(lessonId as number, { size: 50 }, signal),
    enabled: lessonId != null && enabled,
  });
}

/**
 * Команды листа. Ответ каждой — лист целиком с новой версией, счётчиками и флагами,
 * поэтому он кладётся в кэш напрямую: перезапрашивать состояние, которое только что
 * прислали, значит на секунду показать старую версию и дать отправить её обратно.
 *
 * История растёт от любой из трёх команд, но приходит отдельным запросом — её
 * сбрасываем.
 */
function useAttendanceCommand<TVars>(
  lessonId: number,
  mutationFn: (vars: TVars) => Promise<AttendanceSheet>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (sheet) => {
      // Плитка на карточке урока читает тот же ключ, поэтому обновляется вместе с
      // экраном. Сбрасывать `keys.lesson` нельзя: он префикс ключа листа, и
      // инвалидация тут же перезапросила бы то, что мы только что положили.
      qc.setQueryData(keys.attendanceSheet(lessonId), sheet);
      qc.invalidateQueries({ queryKey: keys.attendanceHistory(lessonId) });
    },
  });
}

export function useSaveAttendanceDraft(lessonId: number) {
  return useAttendanceCommand(
    lessonId,
    (vars: { entries: AttendanceEntryChange[]; expectedVersion: number | null }) =>
      attendanceApi.saveDraft(lessonId, vars),
  );
}

export function useMarkAllPresent(lessonId: number) {
  return useAttendanceCommand(
    lessonId,
    (vars: { expectedVersion: number | null; confirmOverwrite: boolean }) =>
      attendanceApi.markAllPresent(lessonId, vars),
  );
}

export function usePublishAttendance(lessonId: number) {
  return useAttendanceCommand(lessonId, (vars: { expectedVersion: number | null }) =>
    attendanceApi.publish(lessonId, vars),
  );
}

// ---- Оценки урока (GRADES-001, GRADES-002) ----

/**
 * Шкала оценок — справочник, а не состояние: за сессию она не меняется, и
 * перезапрашивать её на каждом уроке незачем.
 */
export function useGradeScale() {
  return useQuery({
    queryKey: keys.gradeScale,
    queryFn: ({ signal }) => gradesApi.scale(signal),
    staleTime: Infinity,
  });
}

/**
 * Лист оценок урока. Как и лист посещаемости, запрашивается только при праве на него
 * (`VIEW_GRADES`): без него бэкенд ответит 403, и ходить за гарантированной ошибкой
 * ради выключенной плитки незачем.
 */
export function useLessonGradeSheet(lessonId: number | null, enabled = true) {
  return useQuery({
    queryKey: keys.lessonGradeSheet(lessonId ?? 0),
    queryFn: ({ signal }) => gradesApi.lessonSheet(lessonId as number, signal),
    enabled: lessonId != null && enabled,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && (error.status === 403 || error.status === 404)) &&
      failureCount < 2,
  });
}

/**
 * Команды оценок. Ответ команды — сама оценка, а не лист, поэтому лист
 * перезапрашивается: в нём считаются права на каждую строку и лимит на ученика, и
 * собирать это состояние на клиенте значило бы повторять серверные правила.
 *
 * Журнал сбрасывается тем же действием: та же оценка стоит и в нём.
 */
function useGradeCommand<TVars>(lessonId: number, mutationFn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.lessonGradeSheet(lessonId) });
      qc.invalidateQueries({ queryKey: ['gradebook'] });
    },
  });
}

export function useCreateGrade(lessonId: number) {
  return useGradeCommand(
    lessonId,
    (vars: { studentProfileId: number; scaleCode: string; gradeType?: GradeType | null }) =>
      gradesApi.create({
        studentProfileId: vars.studentProfileId,
        sourceType: 'LESSON',
        sourceId: lessonId,
        scaleCode: vars.scaleCode,
        gradeType: vars.gradeType ?? null,
      }),
  );
}

/**
 * Оценка за домашнее задание. Ключ отдельный от урока: у задания своя область
 * («ровно одна актуальная оценка на ученика»), и сбрасывать вместе с ним лист урока
 * незачем — там оценок за этот источник нет.
 */
export function useHomeworkGrades(homeworkId: number | null) {
  return useQuery({
    queryKey: keys.homeworkGrades(homeworkId ?? 0),
    queryFn: ({ signal }) => homeworkApi.grades(homeworkId as number, signal),
    enabled: homeworkId != null,
  });
}

function useHomeworkGradeCommand<TVars>(
  homeworkId: number,
  mutationFn: (vars: TVars) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.homeworkGrades(homeworkId) });
      // Та же оценка стоит в журнале и входит в средний балл ученика.
      qc.invalidateQueries({ queryKey: ['gradebook'] });
    },
  });
}

export function useSetHomeworkGrade(homeworkId: number) {
  return useHomeworkGradeCommand(
    homeworkId,
    (vars: {
      studentProfileId: number;
      scaleCode: string;
      gradeType?: GradeType | null;
      gradeId?: number | null;
    }) =>
      // Вторая оценка за задание отклоняется (GRADE_HOMEWORK_ALREADY_GRADED):
      // исправляют существующую, а не создают ещё одну.
      vars.gradeId
        ? gradesApi.update(vars.gradeId, {
            scaleCode: vars.scaleCode,
            gradeType: vars.gradeType ?? null,
          })
        : gradesApi.create({
            studentProfileId: vars.studentProfileId,
            sourceType: 'HOMEWORK',
            sourceId: homeworkId,
            scaleCode: vars.scaleCode,
            gradeType: vars.gradeType ?? null,
          }),
  );
}

export function useRemoveHomeworkGrade(homeworkId: number) {
  return useHomeworkGradeCommand(homeworkId, (vars: { gradeId: number }) =>
    gradesApi.remove(vars.gradeId));
}

export function useUpdateGrade(lessonId: number) {
  return useGradeCommand(
    lessonId,
    (vars: { gradeId: number; scaleCode: string; gradeType?: GradeType | null }) =>
      gradesApi.update(vars.gradeId, { scaleCode: vars.scaleCode, gradeType: vars.gradeType ?? null }),
  );
}

export function useDeleteGrade(lessonId: number) {
  return useGradeCommand(lessonId, (vars: { gradeId: number }) => gradesApi.remove(vars.gradeId));
}

// ---- Журнал и итоги четверти (GRADEBOOK-001, GRADEBOOK-002) ----

/**
 * Шапка журнала: год, периоды и доступные пары «класс + предмет».
 *
 * Меняется не чаще, чем расписание назначений, поэтому живёт долго: перезапрашивать
 * список классов при каждом переключении четверти незачем.
 */
export function useGradebookContext(enabled = true) {
  return useQuery({
    queryKey: keys.gradebookContext,
    queryFn: ({ signal }) => gradebookApi.context(signal),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && (error.status === 403 || error.status === 404)) &&
      failureCount < 2,
  });
}

export function useJournal(query: JournalQuery | null) {
  return useQuery({
    queryKey: keys.journal(query ?? ({ classId: 0, subjectId: 0, academicPeriodId: 0 } as JournalQuery)),
    queryFn: ({ signal }) => gradebookApi.journal(query as JournalQuery, signal),
    enabled: query != null,
    placeholderData: (previous) => previous,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && (error.status === 403 || error.status === 404)) &&
      failureCount < 2,
  });
}

/**
 * Итоги класса за период. Нужны и журналу (колонка «Итог. четв.»), и вкладке итогов —
 * ключ у них общий, поэтому вторая вкладка открывается уже с данными.
 */
export function useClassFinals(
  query: Omit<JournalQuery, 'dateFrom' | 'dateTo'> | null,
  enabled = true,
) {
  return useQuery({
    queryKey: keys.classFinals(
      query ?? ({ classId: 0, subjectId: 0, academicPeriodId: 0 } as JournalQuery),
    ),
    queryFn: ({ signal }) => finalGradesApi.ofClass(query as JournalQuery, signal),
    enabled: query != null && enabled,
    placeholderData: (previous) => previous,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && (error.status === 403 || error.status === 404)) &&
      failureCount < 2,
  });
}

/**
 * Команды итоговых оценок. Сбрасывают всё дерево журнала: выставленный итог виден и в
 * колонке «Итог. четв.», а публикация меняет статус сразу у всего набора.
 */
function useFinalGradeCommand<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gradebook'] }),
  });
}

export function useSetFinalGrade() {
  return useFinalGradeCommand(
    (vars: {
      finalGradeId: number | null;
      studentProfileId: number;
      subjectId: number;
      academicPeriodId: number;
      value: number;
    }) =>
      vars.finalGradeId != null
        ? finalGradesApi.changeValue(vars.finalGradeId, vars.value)
        : finalGradesApi.create({
            studentProfileId: vars.studentProfileId,
            subjectId: vars.subjectId,
            academicPeriodId: vars.academicPeriodId,
            value: vars.value,
          }),
  );
}

export function usePublishClassFinals() {
  return useFinalGradeCommand(
    (vars: {
      classId: number;
      subjectId: number;
      academicPeriodId: number;
      subgroupId?: number | null;
    }) => finalGradesApi.publishClass(vars),
  );
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

// ─── Сервисные заявки: сценарий автора (ТЗ SERVICE-FE-001) ────────────────────

/**
 * Свой `accountId`. Живёт долго: за сессию он не меняется, а спрашивают его все три
 * экрана раздела.
 */
export function useMyAccountId(): number | undefined {
  const { data } = useQuery({
    queryKey: keys.myProfile,
    queryFn: ({ signal }) => meApi.profile(signal),
    staleTime: Infinity,
  });
  return data?.accountId;
}

const SERVICE_PAGE_SIZE = 50;

/**
 * Раздел списка заявок (§3).
 *
 * Двумя запросами по статусу, а не одним общим с разбором на клиенте: страница это срез,
 * и смешанная выдача из последних заявок могла бы целиком состоять из выполненных —
 * «Мои заявки» показали бы «пусто» при живых новых на следующей странице.
 */
export function useServiceRequests(section: ServiceSection) {
  return useQuery({
    queryKey: keys.serviceRequests(section),
    queryFn: async ({ signal }) => {
      const pages = await Promise.all(
        SECTION_STATUSES[section].map((status) =>
          serviceRequestsApi.my({ status, size: SERVICE_PAGE_SIZE }, signal),
        ),
      );
      return pages.flatMap((page) => page.content ?? []).sort(byRecency);
    },
    placeholderData: (previous) => previous,
  });
}

export function useServiceRequest(id: number | null) {
  return useQuery({
    queryKey: keys.serviceRequest(id ?? 0),
    queryFn: ({ signal }) => serviceRequestsApi.one(id as number, signal),
    enabled: id != null,
  });
}

/**
 * Лента событий заявки (§9).
 *
 * Своим запросом, а не полем карточки: у неё свой отказ, и недоступная хронология не
 * должна прятать статус, местоположение и описание.
 */
export function useServiceRequestHistory(id: number | null) {
  return useQuery({
    queryKey: keys.serviceRequestHistory(id ?? 0),
    queryFn: ({ signal }) => serviceRequestsApi.history(id as number, signal),
    enabled: id != null,
  });
}

/** Общий сброс раздела: после любого действия оба списка и карточка перечитываются. */
function useServiceRequestCommand<TVars, TData>(mutationFn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-requests'] });
    },
  });
}

export function useCreateServiceRequest() {
  return useServiceRequestCommand((input: CreateServiceRequestInput) =>
    serviceRequestsApi.create(input),
  );
}

/** §7: отмена новой заявки. Она не исчезает, а переезжает в «Историю» как «Отменена». */
export function useCancelServiceRequest() {
  return useServiceRequestCommand((id: number) => serviceRequestsApi.cancel(id));
}

/**
 * §8: возврат выполненной заявки в работу.
 *
 * Экран показывает то состояние, которое вернул бэкенд: он же решает, достанется ли
 * заявка прежнему исполнителю (`IN_PROGRESS`) или уйдёт в очередь службы (`NEW`).
 */
export function useReopenServiceRequest() {
  return useServiceRequestCommand(({ id, comment }: { id: number; comment: string }) =>
    serviceRequestsApi.reopen(id, comment),
  );
}

// ─── Сервисные заявки: разделы Super Admin (ТЗ SERVICE-FE-004) ────────────────

/**
 * §5–§7: все заявки школы с фильтрами и поиском.
 *
 * Страница и порядок целиком серверные: «последняя активность сверху» — это сортировка
 * запроса (SERVICE-BE-007 §2), и пересортировать пришедшие двадцать строк значило бы
 * навести порядок внутри чужого среза.
 *
 * `placeholderData` держит прежнюю страницу, пока грузится следующая: иначе таблица
 * схлопывалась бы в скелет на каждое нажатие в поиске.
 */
export function useAllServiceRequests(filter: AllRequestsFilter, page: number) {
  return useQuery({
    queryKey: keys.allServiceRequests(filter, page),
    queryFn: ({ signal }) => serviceRequestsAdminApi.all(filter, page, ADMIN_PAGE_SIZE, signal),
    placeholderData: (previous) => previous,
  });
}

/** §9: глобальный журнал событий. Read-only, поэтому мутаций рядом нет вовсе. */
export function useServiceAudit(filter: AuditFilter, page: number) {
  return useQuery({
    queryKey: keys.serviceAudit(filter, page),
    queryFn: ({ signal }) => serviceRequestsAdminApi.audit(filter, page, AUDIT_PAGE_SIZE, signal),
    placeholderData: (previous) => previous,
  });
}

/**
 * Заявки, которые сейчас числятся за сотрудником (§4).
 *
 * Только `IN_PROGRESS`: именно их блокировка и несовместимая смена роли возвращают в
 * очередь, а новые, выполненные и отменённые не трогают. Показывать рядом с кнопкой
 * заявки, на которые она не влияет, значило бы обещать не то.
 */
export function useAssignedServiceRequests(accountId: number | null) {
  return useQuery({
    queryKey: keys.assignedServiceRequests(accountId ?? 0),
    queryFn: ({ signal }) =>
      serviceRequestsAdminApi.all(
        { ...EMPTY_REQUESTS_FILTER, assigneeId: accountId, status: 'IN_PROGRESS' },
        0,
        20,
        signal,
      ),
    enabled: accountId != null,
  });
}

// ---- Материалы урока и AI-задание (HOMEWORK-BE-006) ----

export function useLessonMaterials(lessonId: number | null, childId?: number) {
  return useQuery({
    queryKey: keys.lessonMaterials(lessonId ?? 0, childId),
    queryFn: ({ signal }) => lessonMaterialsApi.list(lessonId as number, childId, signal),
    enabled: lessonId != null,
  });
}

/**
 * Общий хвост правок материала: список и счётчик в карточке урока обязаны сходиться.
 * Забыть про второй ключ — значит показать «Материалы · 3» над списком из двух.
 */
function useLessonMaterialCommand<TVars>(
  lessonId: number,
  mutationFn: (vars: TVars) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lessons', lessonId, 'materials'] });
      void qc.invalidateQueries({ queryKey: keys.lesson(lessonId) });
    },
  });
}

export function useAddLessonMaterialFile(lessonId: number) {
  return useLessonMaterialCommand(lessonId, (file: File) =>
    lessonMaterialsApi.addFile(lessonId, file),
  );
}

export function useAddLessonMaterialLink(lessonId: number) {
  return useLessonMaterialCommand(lessonId, (url: string) =>
    lessonMaterialsApi.addLink(lessonId, url),
  );
}

export function useSetLessonMaterialVisibility(lessonId: number) {
  return useLessonMaterialCommand(
    lessonId,
    (vars: { materialId: number; visibleToStudents: boolean }) =>
      lessonMaterialsApi.setVisibility(lessonId, vars.materialId, vars.visibleToStudents),
  );
}

export function useDeleteLessonMaterial(lessonId: number) {
  return useLessonMaterialCommand(lessonId, (materialId: number) =>
    lessonMaterialsApi.remove(lessonId, materialId),
  );
}

export function useHomeworkAiQuota(enabled = true) {
  return useQuery({
    queryKey: keys.homeworkAiQuota,
    queryFn: ({ signal }) => homeworkAiApi.quota(signal),
    enabled,
    // Квота меняется только нашими же генерациями, и каждая из них её инвалидирует.
    staleTime: 60_000,
  });
}

/**
 * Опрос задачи генерации.
 *
 * <p>Интервал 1.5 с и остановка на терминальном статусе — как у {@link useGenerationJob}
 * вступительных тестов. Опрос, а не push: в React Native нет нативного EventSource, и
 * держать два разных механизма доставки одного и того же результата незачем.
 */
export function useHomeworkAiJob(jobId: number | null) {
  return useQuery({
    queryKey: keys.homeworkAiJob(jobId ?? 0),
    queryFn: ({ signal }) => homeworkAiApi.job(jobId as number, signal),
    enabled: jobId != null,
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!job) return 1500;
      return job.status === 'PENDING' || job.status === 'RUNNING' ? 1500 : false;
    },
    // Генерация идёт секунды и стоит денег, и ждать её учитель уходит в соседнюю
    // вкладку. По умолчанию опрос в скрытой вкладке встаёт, и вернувшийся видит
    // замерший индикатор — ровно то «приложение зависло», против которого этот
    // индикатор и сделан. Лишний запрос раз в 1.5 с живёт только пока задача идёт.
    refetchIntervalInBackground: true,
  });
}

export function useHomeworkAiJobs(homeworkId: number | null) {
  return useQuery({
    queryKey: keys.homeworkAiJobs(homeworkId ?? 0),
    queryFn: ({ signal }) => homeworkAiApi.jobs(homeworkId as number, signal),
    enabled: homeworkId != null,
    // Окно генерации закрывают и уходят: карточка — второе место, где учитель
    // узнаёт, что задача ещё идёт и что результат уже ждёт решения. Пока
    // незаконченных задач нет, опроса тоже нет.
    refetchInterval: (query) =>
      (query.state.data ?? []).some(
        (job) => job.status === 'PENDING' || job.status === 'RUNNING',
      )
        ? 2000
        : false,
    refetchIntervalInBackground: true,
  });
}

export function useStartHomeworkAiGeneration(homeworkId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { key: string; input: StartGenerationRequest }) =>
      homeworkAiApi.startGeneration(homeworkId, vars.key, vars.input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.homeworkAiJobs(homeworkId) });
      void qc.invalidateQueries({ queryKey: keys.homeworkAiQuota });
    },
  });
}

/** Применение и возврат меняют содержимое задания — сбрасываем и его, и вопросы. */
function useHomeworkAiResultCommand(mutationFn: (jobId: number) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      // Раздел целиком: карточка задания лежит под ['homework', 'card', id], список —
      // под своим ключом, а применение результата меняет и описание, и вопросы.
      // Так и задумано в этом файле — «любое действие с заданием сбрасывает раздел».
      void qc.invalidateQueries({ queryKey: ['homework'] });
    },
  });
}

export function useApplyHomeworkAiResult(homeworkId: number) {
  return useHomeworkAiResultCommand((jobId: number) => homeworkAiApi.apply(homeworkId, jobId));
}

/**
 * Что предлагает модель. Спрашивается только когда предпросмотр открыт: содержимое
 * результата больше самой задачи, и тянуть его вместе со списком незачем.
 */
export function useHomeworkAiResult(homeworkId: number, jobId: number | null) {
  return useQuery({
    queryKey: [...keys.homeworkAiJobs(homeworkId), 'result', jobId ?? 0],
    queryFn: ({ signal }) => homeworkAiApi.result(homeworkId, jobId as number, signal),
    enabled: jobId != null,
  });
}

/** «Оставить как есть»: вариант модели отклонён, задание не тронуто. */
export function useDiscardHomeworkAiResult(homeworkId: number) {
  return useHomeworkAiResultCommand((jobId: number) => homeworkAiApi.discard(homeworkId, jobId));
}

export function useRevertHomeworkAiResult(homeworkId: number) {
  return useHomeworkAiResultCommand((jobId: number) => homeworkAiApi.revert(homeworkId, jobId));
}

export function useSuggestGrades(homeworkId: number, studentProfileId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      homeworkAiApi.suggestGrades(homeworkId, studentProfileId, key),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.homeworkAiQuota });
    },
  });
}

// ---- Вопросы задания ----

export function useHomeworkQuestions(homeworkId: number | null) {
  return useQuery({
    queryKey: keys.homeworkQuestions(homeworkId ?? 0),
    queryFn: ({ signal }) => homeworkQuestionsApi.list(homeworkId as number, signal),
    enabled: homeworkId != null,
  });
}

export function useSaveHomeworkQuestions(homeworkId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveQuestionsRequest) => homeworkQuestionsApi.save(homeworkId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.homeworkQuestions(homeworkId) });
      // questionCount в карточке задания меняется вместе с составом вопросов, а её
      // ключ живёт в самой странице — сбрасываем раздел, как принято в этом файле.
      void qc.invalidateQueries({ queryKey: ['homework'] });
    },
  });
}

export function useRegenerateQuestion(homeworkId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { questionId: number; key: string; teacherPrompt?: string }) =>
      homeworkQuestionsApi.regenerate(
        homeworkId, vars.questionId, vars.key, vars.teacherPrompt,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.homeworkAiQuota });
    },
  });
}

// ---- Ответы на тест ----

export function useMyHomeworkQuestions(homeworkId: number | null) {
  return useQuery({
    queryKey: keys.homeworkMyQuestions(homeworkId ?? 0),
    queryFn: ({ signal }) => homeworkAnswersApi.myQuestions(homeworkId as number, signal),
    enabled: homeworkId != null,
  });
}

export function useStudentAnswers(homeworkId: number | null, studentProfileId: number | null) {
  return useQuery({
    queryKey: keys.homeworkAnswers(homeworkId ?? 0, studentProfileId ?? 0),
    queryFn: ({ signal }) =>
      homeworkAnswersApi.ofStudent(homeworkId as number, studentProfileId as number, signal),
    enabled: homeworkId != null && studentProfileId != null,
  });
}

export function useSetAnswerScores(homeworkId: number, studentProfileId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetAnswerScoresRequest) =>
      homeworkAnswersApi.setScores(homeworkId, studentProfileId, input),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: keys.homeworkAnswers(homeworkId, studentProfileId),
      });
    },
  });
}
