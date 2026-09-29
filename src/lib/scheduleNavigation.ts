export const SCHEDULE_PATH = '/lesson-schedule';
const CONTEXT_KEYS = ['year', 'periodId', 'classId', 'scheduleId'] as const;
export type ScheduleContext = Record<(typeof CONTEXT_KEYS)[number], string | null>;

export function hasScheduleContext(params: URLSearchParams): boolean {
  return CONTEXT_KEYS.some((key) => params.has(key));
}

/** Empty period/class means an explicitly cleared selector; null means default. */
export function readScheduleContext(params: URLSearchParams): ScheduleContext {
  return Object.fromEntries(CONTEXT_KEYS.map((key) => {
    const raw = params.get(key);
    const emptyAllowed = key === 'periodId' || key === 'classId';
    const validId = raw != null && /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw));
    return [key, validId || (emptyAllowed && raw === '') ? raw : null];
  })) as ScheduleContext;
}

export function writeScheduleContext(context: ScheduleContext): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of CONTEXT_KEYS) {
    if (context[key] != null) params.set(key, context[key]);
  }
  return params;
}

export function hasInvalidScheduleContext(params: URLSearchParams): boolean {
  const parsed = readScheduleContext(params);
  return CONTEXT_KEYS.some((key) => params.has(key) && parsed[key] == null);
}

export function scheduleHref(context: ScheduleContext): string {
  const query = writeScheduleContext(context).toString();
  return query ? `${SCHEDULE_PATH}?${query}` : SCHEDULE_PATH;
}

export function scheduleSettingsHref(path: string, context: ScheduleContext): string {
  const params = writeScheduleContext(context);
  params.set('returnTo', scheduleHref(context));
  return `${path}?${params}`;
}

/** Only the constructor and its known numeric filters can be a return target. */
export function scheduleReturnTo(params: URLSearchParams): string {
  const raw = params.get('returnTo');
  if (raw) {
    try {
      const base = 'https://fiztex.invalid';
      const target = new URL(raw, base);
      if (raw.startsWith('/') && !raw.startsWith('//') && target.origin === base && target.pathname === SCHEDULE_PATH) {
        return scheduleHref(readScheduleContext(target.searchParams));
      }
    } catch { /* Ignore malformed or external return targets. */ }
  }
  return scheduleHref(readScheduleContext(params));
}
