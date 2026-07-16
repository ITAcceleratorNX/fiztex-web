import type {
  Admin,
  Applicant,
  ApplicantRequest,
  AssignResult,
  ConfirmReviewRequest,
  MonitoringAttemptItem,
  NotificationItem,
  Page,
  ReviewDetail,
  ScoreAnswerRequest,
  Subject,
  SubjectRequest,
  Material,
  MaterialUpdateRequest,
  MaterialDownloadResponse,
  GenerateTestRequest,
  GenerationJobResponse,
  SuspiciousLogItem,
  Test,
  TestAssignmentView,
  TestRequest,
  UnreadCountResponse,
} from './types';

const TOKEN_KEY = 'fiztex.token';

// The auth token is a session credential (not application data), so persisting it is fine.
let authToken: string | null = localStorage.getItem(TOKEN_KEY);

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/** Subscribe to admin-session expiry (HTTP 401). Returns unsubscribe. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) {
    listener();
  }
}

function handleUnauthorized(): never {
  setToken(null);
  notifySessionExpired();
  throw new ApiError(401, 'Сессия истекла. Войдите снова.');
}

export function getToken(): string | null {
  return authToken;
}

export function setToken(token: string | null): void {
  authToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  /** Backend conflict / business code, e.g. BELL_TEMPLATE_IN_USE_PUBLISHED. */
  code?: string;
  /** Optional structured payload (usage counters, bound-class conflicts, …). */
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }

  /** Backend signals "choose version strategy" with HTTP 409 on test update. */
  get isVersionDecision(): boolean {
    return this.status === 409;
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

/** Shared JSON request helper — used by admissions `api` and schedule-settings client. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, 'Не удалось соединиться с сервером. Проверьте, запущен ли backend.');
  }

  if (response.status === 401) {
    handleUnauthorized();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? safeParse(text) : undefined;

  if (!response.ok) {
    throw toApiError(response.status, data);
  }

  return data as T;
}

export async function requestMultipart<T>(path: string, formData: FormData, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: 'POST',
      headers,
      body: formData,
      signal,
    });
  } catch {
    throw new ApiError(0, 'Не удалось соединиться с сервером. Проверьте, запущен ли backend.');
  }

  if (response.status === 401) {
    handleUnauthorized();
  }

  const text = await response.text();
  const data = text ? safeParse(text) : undefined;

  if (!response.ok) {
    throw toApiError(response.status, data);
  }

  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toApiError(status: number, data: unknown): ApiError {
  const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined;
  const message = (body && typeof body.message === 'string' && body.message) || `Ошибка ${status}`;
  const code = body && typeof body.code === 'string' ? body.code : undefined;
  const details = body && 'details' in body ? body.details : undefined;
  return new ApiError(status, message, code, details);
}

export function pageQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  }
  const query = qs.toString();
  return query ? `?${query}` : '';
}

export const api = {
  // Auth — backend returns { token, role, fullName }; map login → email for Admin profile.
  login: async (login: string, password: string): Promise<Admin> => {
    const res = await request<{ token: string; role: string; fullName: string }>('/auth/login', {
      method: 'POST',
      body: { login, password },
    });
    return { token: res.token, email: login, fullName: res.fullName };
  },

  // Subjects
  listSubjects: (signal?: AbortSignal) => request<Subject[]>('/admin/subjects', { signal }),
  createSubject: (body: SubjectRequest) =>
    request<Subject>('/admin/subjects', { method: 'POST', body }),
  updateSubject: (id: number, body: SubjectRequest) =>
    request<Subject>(`/admin/subjects/${id}`, { method: 'PUT', body }),
  deleteSubject: (id: number) => request<void>(`/admin/subjects/${id}`, { method: 'DELETE' }),

  // Tests
  listTests: (useAiGeneration?: boolean, signal?: AbortSignal) => {
    const query =
      useAiGeneration === undefined ? '' : `?useAiGeneration=${useAiGeneration}`;
    return request<Test[]>(`/admin/tests${query}`, { signal });
  },
  getTest: (id: number, signal?: AbortSignal) => request<Test>(`/admin/tests/${id}`, { signal }),
  createTest: (body: TestRequest) => request<Test>('/admin/tests', { method: 'POST', body }),
  updateTest: (id: number, body: TestRequest) =>
    request<Test>(`/admin/tests/${id}`, { method: 'PUT', body }),
  deleteTest: (id: number) => request<void>(`/admin/tests/${id}`, { method: 'DELETE' }),
  assignTest: (id: number, applicantIds: number[]) =>
    request<AssignResult>(`/admin/tests/${id}/assign`, { method: 'POST', body: { applicantIds } }),
  changeAssignmentVersion: (testId: number, assignmentId: number, versionNumber: number) =>
    request<TestAssignmentView>(`/admin/tests/${testId}/assignments/${assignmentId}/version`, {
      method: 'PATCH',
      body: { versionNumber },
    }),

  // Review (admin answer checking)
  listReviews: (status?: string, signal?: AbortSignal) =>
    request<ReviewDetail[]>(`/admin/results${status ? `?status=${status}` : ''}`, { signal }),
  getReview: (attemptId: number, signal?: AbortSignal) =>
    request<ReviewDetail>(`/admin/results/attempts/${attemptId}`, { signal }),
  scoreAnswer: (attemptId: number, questionId: number, body: ScoreAnswerRequest) =>
    request<ReviewDetail>(`/admin/results/attempts/${attemptId}/answers/${questionId}`, {
      method: 'PATCH',
      body,
    }),
  confirmReview: (attemptId: number, body: ConfirmReviewRequest) =>
    request<ReviewDetail>(`/admin/results/attempts/${attemptId}/confirm`, { method: 'POST', body }),
  openResult: (attemptId: number) =>
    request<ReviewDetail>(`/admin/results/attempts/${attemptId}/open`, { method: 'POST', body: {} }),

  // Applicants
  listApplicants: (signal?: AbortSignal) => request<Applicant[]>('/admin/applicants', { signal }),
  getApplicant: (id: number, signal?: AbortSignal) =>
    request<Applicant>(`/admin/applicants/${id}`, { signal }),
  createApplicant: (body: ApplicantRequest) =>
    request<Applicant>('/admin/applicants', { method: 'POST', body }),
  updateApplicant: (id: number, body: ApplicantRequest) =>
    request<Applicant>(`/admin/applicants/${id}`, { method: 'PUT', body }),

  // Materials
  listMaterials: (subjectId: number, signal?: AbortSignal) =>
    request<Material[]>(`/materials?subjectId=${subjectId}`, { signal }),
  uploadMaterial: (formData: FormData, signal?: AbortSignal) =>
    requestMultipart<Material>('/materials', formData, signal),
  updateMaterial: (id: number, body: MaterialUpdateRequest) =>
    request<Material>(`/materials/${id}`, { method: 'PATCH', body }),
  deleteMaterial: (id: number) => request<void>(`/materials/${id}`, { method: 'DELETE' }),
  getMaterialDownloadUrl: (id: number, signal?: AbortSignal) =>
    request<MaterialDownloadResponse>(`/materials/${id}/download`, { signal }),
  retryMaterialExtract: (id: number) =>
    request<void>(`/materials/${id}/extract`, { method: 'POST' }),

  // Test generation
  generateTest: (testId: number, body: GenerateTestRequest) =>
    request<GenerationJobResponse>(`/tests/${testId}/generate`, { method: 'POST', body }),
  getGenerationJob: (id: number, signal?: AbortSignal) =>
    request<GenerationJobResponse>(`/generation-jobs/${id}`, { signal }),
  listGenerationJobs: (testId: number, signal?: AbortSignal) =>
    request<GenerationJobResponse[]>(`/tests/${testId}/generation-jobs`, { signal }),

  // Admissions admin (monitoring & notifications)
  listAdmissionsNotifications: (
    params: { unread?: boolean; page?: number; size?: number } = {},
    signal?: AbortSignal,
  ) =>
    request<Page<NotificationItem>>(
      `/admin/admissions/notifications${pageQuery({
        unread: params.unread,
        page: params.page ?? 0,
        size: params.size ?? 20,
      })}`,
      { signal },
    ),
  getAdmissionsUnreadCount: (signal?: AbortSignal) =>
    request<UnreadCountResponse>('/admin/admissions/notifications/unread-count', { signal }),
  markAdmissionsNotificationRead: (id: number) =>
    request<void>(`/admin/admissions/notifications/${id}/read`, { method: 'POST' }),
  markAllAdmissionsNotificationsRead: () =>
    request<void>('/admin/admissions/notifications/read-all', { method: 'POST' }),
  listMonitoringAttempts: (
    params: { status?: string; page?: number; size?: number } = {},
    signal?: AbortSignal,
  ) =>
    request<Page<MonitoringAttemptItem>>(
      `/admin/admissions/attempts${pageQuery({
        status: params.status,
        page: params.page ?? 0,
        size: params.size ?? 100,
      })}`,
      { signal },
    ),
  getAttemptLogs: (attemptId: number, page = 0, size = 20, signal?: AbortSignal) =>
    request<Page<SuspiciousLogItem>>(
      `/admin/admissions/attempts/${attemptId}/logs${pageQuery({ page, size })}`,
      { signal },
    ),
  allowRetake: (assignmentId: number) =>
    request<void>(`/admin/admissions/assignments/${assignmentId}/allow-retake`, { method: 'POST' }),
};
