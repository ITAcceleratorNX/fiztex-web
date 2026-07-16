import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getToken, setToken, api, onSessionExpired } from '@/lib/api';
import type { Admin } from '@/lib/types';

const PROFILE_KEY = 'fiztex.profile';

interface AuthContextValue {
  admin: Admin | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
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
  const [admin, setAdmin] = useState<Admin | null>(loadProfile);

  useEffect(() => {
    return onSessionExpired(() => {
      localStorage.removeItem(PROFILE_KEY);
      setAdmin(null);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    persist(result);
    setAdmin(result);
  }, []);

  const logout = useCallback(() => {
    const token = getToken();
    if (token) {
      invalidateServerSession(token);
    }
    clearLocalSession();
    setAdmin(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ admin, isAuthenticated: Boolean(admin), login, logout }),
    [admin, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
