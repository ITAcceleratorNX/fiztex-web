import { ApiError } from './api';
import type {
  AssignmentListResponse,
  ApplicantResult,
  AttemptDetail,
  AttemptEventType,
  SaveAnswerResponse,
  SubmitResponse,
  VerifyCodeResponse,
} from './entranceTypes';

// The applicant session token and the id of the attempt currently being taken are session
// credentials / navigation pointers — not application data. They live in sessionStorage so a page
// refresh keeps the applicant in the flow, while the backend stays the single source of truth for
// answers, status and remaining time (per TЗ: mock/localStorage не как финальное решение).
const TOKEN_KEY = 'fiztex.entrance.token';
const ATTEMPT_KEY = 'fiztex.entrance.attemptId';

let entranceToken: string | null = sessionStorage.getItem(TOKEN_KEY);

export function getEntranceToken(): string | null {
  return entranceToken;
}

export function setEntranceToken(token: string | null): void {
  entranceToken = token;
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export function getActiveAttemptId(): number | null {
  const raw = sessionStorage.getItem(ATTEMPT_KEY);
  return raw ? Number(raw) : null;
}

export function setActiveAttemptId(attemptId: number | null): void {
  if (attemptId != null) sessionStorage.setItem(ATTEMPT_KEY, String(attemptId));
  else sessionStorage.removeItem(ATTEMPT_KEY);
}

export function clearEntranceSession(): void {
  setEntranceToken(null);
  setActiveAttemptId(null);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Use keepalive so the request survives page unload (for the page_closed event). */
  keepalive?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (entranceToken) headers['Authorization'] = `Bearer ${entranceToken}`;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      keepalive: options.keepalive,
    });
  } catch {
    throw new ApiError(0, 'Не удалось соединиться с сервером. Проверьте, запущен ли backend.');
  }

  if (response.status === 401) {
    clearEntranceSession();
    throw new ApiError(401, 'Сессия истекла. Войдите по коду заново.');
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

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const entranceApi = {
  verifyCode: async (code: string): Promise<VerifyCodeResponse> => {
    const result = await request<VerifyCodeResponse>('/admissions/access-code/verify', {
      method: 'POST',
      body: { code },
    });
    setEntranceToken(result.accessToken);
    return result;
  },

  getAssignments: () => request<AssignmentListResponse>('/admissions/applicant/assignments'),

  getResult: (assignmentId: number) =>
    request<ApplicantResult>(`/admissions/assignments/${assignmentId}/result`),

  startAttempt: (assignmentId: number) =>
    request<AttemptDetail>('/admissions/attempts/start', { method: 'POST', body: { assignmentId } }),

  getAttempt: (attemptId: number) => request<AttemptDetail>(`/admissions/attempts/${attemptId}`),

  saveAnswer: (
    attemptId: number,
    body: { questionId: number; selectedOptionIds?: number[]; openTextAnswer?: string | null },
  ) =>
    request<SaveAnswerResponse>(`/admissions/attempts/${attemptId}/answers`, {
      method: 'POST',
      body,
    }),

  submitAttempt: (attemptId: number) =>
    request<SubmitResponse>(`/admissions/attempts/${attemptId}/submit`, { method: 'POST', body: {} }),

  logEvent: (attemptId: number, type: AttemptEventType, details?: string, keepalive = false) =>
    request<void>(`/admissions/attempts/${attemptId}/events`, {
      method: 'POST',
      body: { type, details },
      keepalive,
    }).catch(() => {
      /* Anti-cheat logging is best-effort and must never break the attempt UX. */
    }),
};
