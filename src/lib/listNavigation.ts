/** Общие операции над URL-состоянием списков. Фильтры принадлежат адресной строке,
 * но каждая страница сама задаёт допустимые ключи и значения. */
export type SearchParamValue = string | number | boolean | null | undefined;
const LIST_STATE_PREFIX = 'fiztex.list-state:';
const LIST_SCROLL_PREFIX = 'fiztex.list-scroll:';

export function mergeSearchParams(
  current: URLSearchParams,
  patch: Record<string, SearchParamValue>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === '') next.delete(key);
    else next.set(key, String(value));
  }
  return next;
}

/** URL-страницы списков показывают номер с единицы; UI и сервер используют ноль. */
export function parseOneBasedPage(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 0;
  const oneBasedPage = Number(value);
  return Number.isSafeInteger(oneBasedPage) ? oneBasedPage - 1 : 0;
}

export function parsePositiveInteger(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}

export function isValidIsoDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function accountSessionKey(): string {
  try {
    const profile = JSON.parse(localStorage.getItem('fiztex.profile') ?? 'null') as { email?: unknown } | null;
    return typeof profile?.email === 'string' ? encodeURIComponent(profile.email.toLowerCase()) : 'anonymous';
  } catch {
    return 'anonymous';
  }
}

export function listNavigationStorageKey(namespace: string): string {
  return `${LIST_STATE_PREFIX}${accountSessionKey()}:${namespace}`;
}

export function listScrollStorageKey(namespace: string): string {
  return `${LIST_SCROLL_PREFIX}${accountSessionKey()}:${namespace}`;
}

/** Auth transitions discard state from the previous account session. */
export function clearListNavigationSession(): void {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(LIST_STATE_PREFIX) || key?.startsWith(LIST_SCROLL_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Storage may be disabled by the browser; URL navigation remains functional.
  }
}
