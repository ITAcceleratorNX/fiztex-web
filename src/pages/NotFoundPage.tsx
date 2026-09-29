import { ArrowLeft, ArrowRight, Home, LogIn } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button, buttonClassName } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { landingRouteForRole, ROUTES } from '@/lib/routes';

function NotFoundContent({
  authenticated,
  homeRoute,
}: {
  authenticated: boolean;
  homeRoute: string;
}) {
  const navigate = useNavigate();

  return (
    <section aria-labelledby="not-found-title" className="mx-auto max-w-2xl">
      <div className="card flex flex-col items-center px-6 py-16 text-center sm:px-10">
        <p className="text-sm font-bold tracking-[0.2em] text-brand-600">404</p>
        <h1 id="not-found-title" className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
          Страница не найдена
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">
          Такой страницы нет или ссылка устарела. Вернитесь назад или откройте доступный вам главный раздел.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="secondary" icon={<ArrowLeft />} onClick={() => navigate(-1)}>
            Назад
          </Button>
          <Link
            to={homeRoute}
            className={buttonClassName()}
            aria-label={authenticated ? 'Перейти в свой раздел' : 'Перейти на публичную главную'}
          >
            <span className="inline-flex items-center gap-2">
              <Home className="size-4" />
              {authenticated ? 'Мой главный раздел' : 'На главную'}
            </span>
          </Link>
          {!authenticated && (
            <Link to={ROUTES.staffLogin} className={buttonClassName({ variant: 'secondary' })}>
              <span className="inline-flex items-center gap-2">
                <LogIn className="size-4" />
                Войти
              </span>
            </Link>
          )}
        </div>

        {authenticated && (
          <p className="mt-5 inline-flex items-center gap-1 text-xs text-slate-500">
            <ArrowRight className="size-3" />
            Откроется раздел, подходящий для вашей роли.
          </p>
        )}
      </div>
    </section>
  );
}

export function NotFoundRoute() {
  const { admin, isAuthenticated } = useAuth();
  const homeRoute = isAuthenticated
    ? landingRouteForRole(admin?.role)
    : ROUTES.publicAnnouncements;
  const page = <NotFoundContent authenticated={isAuthenticated} homeRoute={homeRoute} />;

  return isAuthenticated ? <AppLayout>{page}</AppLayout> : page;
}
