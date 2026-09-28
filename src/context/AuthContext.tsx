import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getToken, setToken, api, onSessionExpired } from '@/lib/api';
import type { Admin } from '@/lib/types';
import { clearListNavigationSession } from '@/lib/listNavigation';
import { FormDraftProvider, FormDraftStore } from './FormDraftContext';

const PROFILE_KEY = 'fiztex.profile';

interface AuthContextValue {
  admin: Admin | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<Admin>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function clearLocalSession(): void {
  setToken(null);
  localStorage.removeItem(PROFILE_KEY);
}

function loadProfile(): Admin | null {
  const token = getToken();
  if (!token) return null;
  // Reject leftover mock tokens from PHYCORE-003 offline login.
  if (token.startsWith('mock-platform.')) {
    clearLocalSession();
    return null;
  }
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Admin;
  } catch {
    return null;
  }
}

function persist(admin: Admin): void {
  setToken(admin.token);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(admin));
}

function createSession(admin: Admin | null, revision = 0) {
  return {
    admin,
    revision,
    drafts: new FormDraftStore(),
    queryClient: new QueryClient({
      defaultOptions: {
        queries: {
          retry: 1,
          refetchOnWindowFocus: false,
          staleTime: 15_000,
        },
      },
    }),
  };
}

/** Fire-and-forget server logout so tokenVersion is bumped; ignores network/HTTP errors. */
function invalidateServerSession(token: string): void {
  void fetch('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {
    /* ignore — local session is cleared regardless */
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(() => createSession(loadProfile()));
  const sessionRef = useRef(session);
  const { admin } = session;

  const replaceSession = useCallback((nextAdmin: Admin | null) => {
    clearListNavigationSession();
    const previous = sessionRef.current;
    const next = createSession(nextAdmin, previous.revision + 1);
    sessionRef.current = next;
    // Abort active queries and discard both query and mutation caches. A new
    // client keeps late mutation callbacks confined to the previous session.
    void previous.queryClient.cancelQueries();
    previous.queryClient.clear();
    previous.drafts.dispose();
    setSession(next);
  }, []);

  useEffect(() => {
    return onSessionExpired(() => {
      localStorage.removeItem(PROFILE_KEY);
      // A rejected login has no authenticated session to discard. Keep the
      // login form mounted so it can display its error and retain the input.
      if (sessionRef.current.admin) replaceSession(null);
    });
  }, [replaceSession]);

  // Возвращает аккаунт, а не void: вызывающему нужна роль, чтобы выбрать стартовый экран,
  // а состояние контекста на этот момент ещё не обновилось.
  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    persist(result);
    replaceSession(result);
    return result;
  }, [replaceSession]);

  const logout = useCallback(() => {
    if (sessionRef.current.drafts.hasChanges && !window.confirm(
      'В этой вкладке есть несохранённые формы. Выйти из аккаунта и удалить введённые данные и выбранные файлы?',
    )) return;
    const token = getToken();
    if (token) {
      invalidateServerSession(token);
    }
    clearLocalSession();
    replaceSession(null);
  }, [replaceSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ admin, isAuthenticated: Boolean(admin), login, logout }),
    [admin, login, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {/* Remount session consumers too: local form state and notifications must
          not outlive the account that created them. The router stays outside. */}
      <QueryClientProvider key={session.revision} client={session.queryClient}>
        <FormDraftProvider store={session.drafts}>{children}</FormDraftProvider>
      </QueryClientProvider>
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
