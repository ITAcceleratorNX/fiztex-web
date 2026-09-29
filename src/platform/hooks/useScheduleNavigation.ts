import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  hasInvalidScheduleContext,
  hasScheduleContext,
  readScheduleContext,
  scheduleReturnTo,
  writeScheduleContext,
  type ScheduleContext,
} from '@/lib/scheduleNavigation';

export function useScheduleReturnTo(): string {
  const { search } = useLocation();
  return scheduleReturnTo(new URLSearchParams(search));
}

export function useScheduleNavigation() {
  const { admin } = useAuth();
  const { search } = useLocation();
  const navigate = useNavigate();
  // Store only navigation IDs, never credentials or entity data. A different
  // account must not inherit the previous user's last selected class.
  const storageKey = admin?.email ? `fiztex.schedule.context:${encodeURIComponent(admin.email)}` : null;
  const params = useMemo(() => {
    const explicit = new URLSearchParams(search);
    if (hasScheduleContext(explicit) || !storageKey) return explicit;
    try {
      return new URLSearchParams(sessionStorage.getItem(storageKey) ?? search);
    } catch {
      return explicit;
    }
  }, [search, storageKey]);
  const context = useMemo(() => readScheduleContext(params), [params]);
  const invalid = hasInvalidScheduleContext(params);
  const contextRef = useRef(context);
  const searchRef = useRef(search);
  contextRef.current = context;
  searchRef.current = search;

  const setContext = useCallback((patch: Partial<ScheduleContext>, replace = false) => {
    const next = { ...contextRef.current, ...patch };
    const nextSearch = writeScheduleContext(next).toString();
    contextRef.current = next;
    if (nextSearch === searchRef.current.replace(/^\?/, '')) return;
    searchRef.current = nextSearch ? `?${nextSearch}` : '';
    navigate({ search: searchRef.current }, { replace });
  }, [navigate]);

  // Canonicalize restored state so refresh, copied links and browser history
  // use the same source of truth as the controls.
  useEffect(() => {
    if (!hasScheduleContext(new URLSearchParams(search)) && hasScheduleContext(params)) {
      setContext(context, true);
    }
  }, [search, params, context, setContext]);

  const rememberContext = useCallback((validated: ScheduleContext) => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, writeScheduleContext(validated).toString());
    } catch { /* URL navigation still works when browser storage is unavailable. */ }
  }, [storageKey]);

  return { context, invalid, setContext, rememberContext };
}
