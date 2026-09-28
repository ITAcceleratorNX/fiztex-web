import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { resolveLoginRedirect } from '@/lib/routes';

interface LoginLocationState {
  from?: unknown;
  recoveryLogin?: unknown;
}

export function AuthenticatedLoginRedirect() {
  const { admin } = useAuth();
  const location = useLocation();
  const state = location.state as LoginLocationState | null;
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
