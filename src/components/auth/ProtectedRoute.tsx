import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isRouteAllowedForRole, landingRouteForRole, ROUTES } from '@/lib/routes';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, admin, expiredAccountEmail } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.staffLogin}
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
          recoveryLogin: expiredAccountEmail ?? undefined,
        }}
      />
    );
  }

  if (!isRouteAllowedForRole(location.pathname, admin?.role)) {
    return (
      <Navigate
        to={landingRouteForRole(admin?.role)}
        replace
        state={{
          authNotice: `У вашей роли нет доступа к разделу ${location.pathname}. Открыт стартовый раздел вашей роли.`,
        }}
      />
    );
  }

  return <>{children}</>;
}
