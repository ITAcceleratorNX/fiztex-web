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
import { useNavigate } from 'react-router-dom';
import { ApiError, getToken, setToken, api, onSessionExpired } from '@/lib/api';
import type { Admin } from '@/lib/types';
import { clearListNavigationSession } from '@/lib/listNavigation';
import { isMobileOnlyRole, MOBILE_ONLY_MESSAGE, ROUTES } from '@/lib/routes';
import { FormDraftProvider, FormDraftStore } from './FormDraftContext';

const PROFILE_KEY = 'fiztex.profile';

interface AuthContextValue {
  admin: Admin | null;
  isAuthenticated: boolean;
  expiredAccountEmail: string | null;
  /**
   * Временный пароль, с которым человек только что вошёл. Живёт в памяти вкладки и
   * нигде не сохраняется: экран смены пароля обязан прислать его как `currentPassword`,
   * но класть секрет в `localStorage` ради одного запроса нельзя. После перезагрузки
   * страницы он теряется — экран смены тогда спрашивает его полем.
   */
  temporarySecret: string | null;
  login: (email: string, password: string) => Promise<Admin>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<Admin>;
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

/**
 * Fire-and-forget server logout so tokenVersion is bumped; ignores network/HTTP errors.
 *
 * Сервер отзывает **все** сессии аккаунта, а не одну вкладку: версия токенов одна на
 * аккаунт. Поэтому для ученика и родителя его не зовём никогда — их живая сессия в
 * мобильном приложении, и выход из панели выкинул бы их оттуда.
 */
function invalidateServerSession(token: string): void {
  void fetch('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {
    /* ignore — local session is cleared regardless */
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => createSession(loadProfile()));
  const [expiredAccountEmail, setExpiredAccountEmail] = useState<string | null>(null);
  const [temporarySecret, setTemporarySecret] = useState<string | null>(null);
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
      setExpiredAccountEmail(sessionRef.current.admin?.email ?? null);
      localStorage.removeItem(PROFILE_KEY);
      // A rejected login has no authenticated session to discard. Keep the
      // login form mounted so it can display its error and retain the input.
      if (sessionRef.current.admin) replaceSession(null);
    });
  }, [replaceSession]);

  // Возвращает ответ входа целиком, чтобы инициатор при необходимости мог проверить
  // роль и идентичность аккаунта до следующего рендера контекста.
  const login = useCallback(async (email: string, password: string) => {
    const result = await api.signIn(email, password);
    // Ученик и родитель входят той же `/auth/sign-in`, что и мобилка, — отличить их можно
    // только по ответу. Сессию не заводим: токен нигде не сохранён и просто отбрасывается.
    // Серверный выход здесь звать нельзя — он отзывает сессии всего аккаунта, и человек,
    // по ошибке открывший панель, вылетел бы из мобильного приложения.
    if (isMobileOnlyRole(result.role)) {
      throw new ApiError(403, MOBILE_ONLY_MESSAGE, 'MOBILE_ONLY_ROLE');
    }
    setExpiredAccountEmail(null);
    setTemporarySecret(result.mustChangePassword ? password : null);
    persist(result);
    replaceSession(result);
    return result;
  }, [replaceSession]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const email = sessionRef.current.admin?.email ?? '';
    const result = await api.changePassword(email, currentPassword, newPassword);
    setTemporarySecret(null);
    persist(result);
    // Сервер отозвал сессии и выдал новый токен, поэтому сессия пересоздаётся целиком:
    // кэш запросов, собранный под 403 `PASSWORD_CHANGE_REQUIRED`, переиспользовать нельзя.
    replaceSession(result);
    return result;
  }, [replaceSession]);

  const logout = useCallback(() => {
    if (sessionRef.current.drafts.hasChanges && !window.confirm(
      'В этой вкладке есть несохранённые формы. Выйти из аккаунта и удалить введённые данные и выбранные файлы?',
    )) return;
    const token = getToken();
    // Сохранённая сессия ученика или родителя — наследие панели до запрета (её показывает
    // `MobileOnlyNotice`): забываем токен у себя, а сессию в приложении не трогаем.
    if (token && !isMobileOnlyRole(sessionRef.current.admin?.role)) {
      invalidateServerSession(token);
    }
    setExpiredAccountEmail(null);
    setTemporarySecret(null);
    clearLocalSession();
    replaceSession(null);
    // Explicit logout must not leave the protected page as the next account's
    // return target on this device.
    navigate(ROUTES.staffLogin, { replace: true });
  }, [navigate, replaceSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      admin,
      isAuthenticated: Boolean(admin),
      expiredAccountEmail,
      temporarySecret,
      login,
      changePassword,
      logout,
    }),
    [admin, expiredAccountEmail, temporarySecret, login, changePassword, logout],
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
