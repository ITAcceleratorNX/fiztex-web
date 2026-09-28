import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listNavigationStorageKey, listScrollStorageKey, mergeSearchParams } from '@/lib/listNavigation';

/** URL is authoritative; an empty list URL can restore the last state for this account session. */
export function useListSearchParams(
  namespace: string,
  stateKeys: readonly string[],
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialized = useRef(false);
  const storageKey = listNavigationStorageKey(namespace);
  const keysSignature = stateKeys.join('\u0000');

  useEffect(() => {
    const keys = keysSignature ? keysSignature.split('\u0000') : [];
    const hasStateInUrl = keys.some((key) => searchParams.has(key));

    function save(params: URLSearchParams) {
      const state = new URLSearchParams();
      for (const key of keys) {
        for (const value of params.getAll(key)) state.append(key, value);
      }
      try {
        if (state.size) sessionStorage.setItem(storageKey, state.toString());
        else sessionStorage.removeItem(storageKey);
      } catch {
        // The URL remains the source of truth when session storage is unavailable.
      }
    }

    if (!initialized.current) {
      initialized.current = true;
      if (hasStateInUrl) {
        save(searchParams);
        return;
      }

      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved) {
          const restored = new URLSearchParams(saved);
          if (keys.some((key) => restored.has(key))) {
            setSearchParams((current) => {
              if (keys.some((key) => current.has(key))) return current;
              const patch: Record<string, string | null> = {};
              for (const key of keys) patch[key] = restored.get(key);
              return mergeSearchParams(current, patch);
            }, { replace: true });
            return;
          }
        }
      } catch {
        // Ignore malformed or inaccessible saved state.
      }
    }

    save(searchParams);
  }, [keysSignature, searchParams, setSearchParams, storageKey]);

  return [searchParams, setSearchParams] as const;
}

/** Save the viewport before leaving a long list and restore it after its data is ready. */
export function useListScrollRestoration(namespace: string, ready: boolean): void {
  const restored = useRef(false);
  const storageKey = listScrollStorageKey(namespace);

  useEffect(() => () => {
    try {
      sessionStorage.setItem(storageKey, String(Math.max(0, Math.round(window.scrollY))));
    } catch {
      // Scroll restoration is an enhancement; normal browser history still works.
    }
  }, [storageKey]);

  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    try {
      const top = Number(sessionStorage.getItem(storageKey));
      if (Number.isFinite(top) && top > 0) {
        window.requestAnimationFrame(() => window.scrollTo({ top, behavior: 'auto' }));
      }
    } catch {
      // Ignore inaccessible or malformed scroll positions.
    }
  }, [ready, storageKey]);
}
