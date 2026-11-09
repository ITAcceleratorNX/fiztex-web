import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isMobileOnlyRole, isRouteAllowedForRole, landingRouteForRole, ROUTES } from '@/lib/routes';
import { MobileOnlyNotice } from './MobileOnlyNotice';

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

  // Раньше чем проверка маршрута: у этих ролей допустимого стартового раздела нет, и
  // разворот на «стартовый раздел роли» зациклился бы.
  if (isMobileOnlyRole(admin?.role)) {
    return <MobileOnlyNotice />;
  }

  // Временный пароль закрывает панель целиком: `PasswordChangeRequiredFilter` пускает
  // только смену пароля и выход, и любой раздел встретил бы человека отказами.
  if (admin?.mustChangePassword) {
    return <Navigate to={ROUTES.staffNewPassword} replace />;
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
