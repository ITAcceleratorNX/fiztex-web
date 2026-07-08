import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from '@/lib/api';
import type { Admin } from '@/lib/types';

const PROFILE_KEY = 'fiztex.profile';

interface AuthContextValue {
  admin: Admin | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadProfile(): Admin | null {
  const token = getToken();
  if (!token) return null;
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Admin;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(loadProfile);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    setToken(result.token);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(result));
    setAdmin(result);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem(PROFILE_KEY);
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
