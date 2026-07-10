import type {
  Admin,
  Applicant,
  ApplicantRequest,
  AssignResult,
  ConfirmReviewRequest,
  ReviewDetail,
  ScoreAnswerRequest,
  Subject,
  SubjectRequest,
  Material,
  MaterialUpdateRequest,
  MaterialDownloadResponse,
  Test,
  TestRequest,
} from './types';

const TOKEN_KEY = 'fiztex.token';

// The auth token is a session credential (not application data), so persisting it is fine.
let authToken: string | null = localStorage.getItem(TOKEN_KEY);

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
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }

  /** Backend signals "choose version strategy" with HTTP 409 on test update. */
  get isVersionDecision(): boolean {
    return this.status === 409;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
    setToken(null);
    throw new ApiError(401, 'Сессия истекла. Войдите снова.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? safeParse(text) : undefined;

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && 'message' in data && (data as { message?: string }).message) ||
      `Ошибка ${response.status}`;
    throw new ApiError(response.status, String(message));
  }

  return data as T;
}

async function requestMultipart<T>(path: string, formData: FormData, signal?: AbortSignal): Promise<T> {
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
    setToken(null);
    throw new ApiError(401, 'Сессия истекла. Войдите снова.');
  }

  const text = await response.text();
  const data = text ? safeParse(text) : undefined;

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && 'message' in data && (data as { message?: string }).message) ||
      `Ошибка ${response.status}`;
    throw new ApiError(response.status, String(message));
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

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<Admin>('/auth/login', { method: 'POST', body: { email, password } }),

  // Subjects
  listSubjects: (signal?: AbortSignal) => request<Subject[]>('/admin/subjects', { signal }),
  createSubject: (body: SubjectRequest) =>
    request<Subject>('/admin/subjects', { method: 'POST', body }),
  updateSubject: (id: number, body: SubjectRequest) =>
    request<Subject>(`/admin/subjects/${id}`, { method: 'PUT', body }),
  deleteSubject: (id: number) => request<void>(`/admin/subjects/${id}`, { method: 'DELETE' }),

  // Tests
  listTests: (signal?: AbortSignal) => request<Test[]>('/admin/tests', { signal }),
  getTest: (id: number, signal?: AbortSignal) => request<Test>(`/admin/tests/${id}`, { signal }),
  createTest: (body: TestRequest) => request<Test>('/admin/tests', { method: 'POST', body }),
  updateTest: (id: number, body: TestRequest) =>
    request<Test>(`/admin/tests/${id}`, { method: 'PUT', body }),
  deleteTest: (id: number) => request<void>(`/admin/tests/${id}`, { method: 'DELETE' }),
  assignTest: (id: number, applicantIds: number[]) =>
    request<AssignResult>(`/admin/tests/${id}/assign`, { method: 'POST', body: { applicantIds } }),

  // Review (admin answer checking)
  listReviews: (signal?: AbortSignal) => request<ReviewDetail[]>('/admin/results', { signal }),
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
};
