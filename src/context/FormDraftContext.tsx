import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode, type SetStateAction } from 'react';

/** In-memory drafts belong to one authenticated session, including File objects. */
export class FormDraftStore {
  private entries = new Map<string, { value: unknown; dirty: boolean }>();
  private listeners = new Set<() => void>();
  private active = true;

  get<T>(key: string): T | undefined { return this.entries.get(key)?.value as T | undefined; }
  set<T>(key: string, value: T, dirty = true): void {
    if (!this.active) return;
    this.entries.set(key, { value, dirty });
    this.listeners.forEach((notify) => notify());
  }
  delete(key: string): void {
    if (this.entries.delete(key)) this.listeners.forEach((notify) => notify());
  }
  subscribe = (notify: () => void) => {
    this.listeners.add(notify);
    return () => { this.listeners.delete(notify); };
  };
  get hasChanges(): boolean { return [...this.entries.values()].some((entry) => entry.dirty); }
  dispose(): void { this.active = false; this.entries.clear(); }
}

const FormDraftContext = createContext<FormDraftStore | null>(null);

export function FormDraftProvider({ children, store }: { children: ReactNode; store?: FormDraftStore }) {
  const [localStore] = useState(() => new FormDraftStore());
  const drafts = store ?? localStore;
  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (!drafts.hasChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    // Stay active on dependency pages and in other sections too.
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [drafts]);
  return <FormDraftContext.Provider value={drafts}>{children}</FormDraftContext.Provider>;
}

export function useFormDraftStore(): FormDraftStore {
  const store = useContext(FormDraftContext);
  if (!store) throw new Error('useFormDraftStore must be used within FormDraftProvider');
  return store;
}

/** Shared by forms that explicitly promise restoration across internal navigation. */
export function useFormDraft<T>(key: string, initial: () => T, isDirty: (value: T) => boolean) {
  const store = useFormDraftStore();
  const [fallback] = useState(initial);
  const draft = useSyncExternalStore(store.subscribe, () => store.get<T>(key)) ?? fallback;
  const setDraft = useCallback((update: SetStateAction<T>) => {
    const current = store.get<T>(key) ?? fallback;
    const next = typeof update === 'function' ? (update as (previous: T) => T)(current) : update;
    if (next !== current) store.set(key, next, isDirty(next));
  }, [store, key, fallback, isDirty]);
  const clear = useCallback(() => store.delete(key), [store, key]);
  useEffect(() => () => {
    const current = store.get<T>(key);
    // A visited, untouched form is not a draft: reopen it from fresh server data.
    if (current !== undefined && !isDirty(current)) store.delete(key);
  }, [store, key, isDirty]);
  return { draft, setDraft, clear };
}
