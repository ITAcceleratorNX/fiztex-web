import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROUTES, resolveLoginRedirect } from '@/lib/routes';

interface LoginLocationState {
  from?: unknown;
  recoveryLogin?: unknown;
}

export function AuthenticatedLoginRedirect() {
  const { admin } = useAuth();
  const location = useLocation();
  const state = location.state as LoginLocationState | null;
  // Вошедшему по временному паролю сохранённый адрес не поможет: до смены пароля
  // бэкенд отвечает 403 на всё остальное.
  if (admin?.mustChangePassword) return <Navigate to={ROUTES.staffNewPassword} replace />;
  const resolution = resolveLoginRedirect(
    state?.from,
    admin?.role,
    state?.recoveryLogin,
    admin?.email,
  );

  return (
    <Navigate
      to={resolution.target}
      replace
      state={resolution.notice ? { authNotice: resolution.notice } : undefined}
    />
  );
}
