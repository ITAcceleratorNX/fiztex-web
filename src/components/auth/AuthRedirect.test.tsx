import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticatedLoginRedirect } from './AuthenticatedLoginRedirect';
import { ProtectedRoute } from './ProtectedRoute';

const auth = vi.hoisted(() => ({
  current: {
    admin: null as { email: string; role: string } | null,
    isAuthenticated: false,
    expiredAccountEmail: null as string | null,
  },
}));

vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth.current }));

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <output data-testid="location">{location.pathname + location.search + location.hash}</output>
      <output data-testid="location-state">{JSON.stringify(location.state ?? null)}</output>
    </>
  );
}

describe('auth redirects', () => {
  beforeEach(() => {
    auth.current = { admin: null, isAuthenticated: false, expiredAccountEmail: null };
  });

  it('сохраняет query, hash и владельца истёкшей сессии до входа', () => {
    auth.current.expiredAccountEmail = 'teacher-a@fiztex.local';

    render(
      <MemoryRouter initialEntries={['/homework/new?lessonId=42&groupId=7#questions']}>
        <Routes>
          <Route path="/staff/login" element={<LocationProbe />} />
          <Route path="*" element={<ProtectedRoute><LocationProbe /></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location')).toHaveTextContent('/staff/login');
    expect(screen.getByTestId('location-state')).toHaveTextContent(
      '"from":"/homework/new?lessonId=42&groupId=7#questions"',
    );
    expect(screen.getByTestId('location-state')).toHaveTextContent(
      '"recoveryLogin":"teacher-a@fiztex.local"',
    );
  });

  it('после входа открывает полный сохранённый адрес без цикла через login', () => {
    auth.current = {
      admin: { email: 'teacher-a@fiztex.local', role: 'TEACHER' },
      isAuthenticated: true,
      expiredAccountEmail: null,
    };

    render(
      <MemoryRouter initialEntries={[{
        pathname: '/staff/login',
        state: {
          from: '/homework/new?lessonId=42&groupId=7#questions',
          recoveryLogin: 'teacher-a@fiztex.local',
        },
      }]}>
        <Routes>
          <Route path="/staff/login" element={<AuthenticatedLoginRedirect />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location')).toHaveTextContent('/homework/new?lessonId=42&groupId=7#questions');
  });

  it('отправляет роль на доступную страницу с объяснением вместо запретного маршрута', () => {
    auth.current = {
      admin: { email: 'teacher@fiztex.local', role: 'TEACHER' },
      isAuthenticated: true,
      expiredAccountEmail: null,
    };

    render(
      <MemoryRouter initialEntries={['/dashboard?view=classes#list']}>
        <Routes>
          <Route path="*" element={<ProtectedRoute><LocationProbe /></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location')).toHaveTextContent('/homework');
    expect(screen.getByTestId('location-state')).toHaveTextContent('authNotice');
    expect(screen.getByTestId('location-state')).toHaveTextContent('/dashboard');
  });

  it('не принимает внешний returnTo после входа', () => {
    auth.current = {
      admin: { email: 'admin@fiztex.local', role: 'ADMIN' },
      isAuthenticated: true,
      expiredAccountEmail: null,
    };

    render(
      <MemoryRouter initialEntries={[{
        pathname: '/staff/login',
        state: { from: '//evil.example/path?secret=1#outside' },
      }]}>
        <Routes>
          <Route path="/staff/login" element={<AuthenticatedLoginRedirect />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
    expect(screen.getByTestId('location')).not.toHaveTextContent('evil.example');
  });

  it('не переносит адрес истёкшей сессии в другой аккаунт и объясняет переход', () => {
    auth.current = {
      admin: { email: 'teacher-b@fiztex.local', role: 'TEACHER' },
      isAuthenticated: true,
      expiredAccountEmail: null,
    };

    render(
      <MemoryRouter initialEntries={[{
        pathname: '/staff/login',
        state: {
          from: '/homework/new?lessonId=42#questions',
          recoveryLogin: 'teacher-a@fiztex.local',
        },
      }]}>
        <Routes>
          <Route path="/staff/login" element={<AuthenticatedLoginRedirect />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location')).toHaveTextContent('/homework');
    expect(screen.getByTestId('location-state')).toHaveTextContent('другой аккаунт');
    expect(screen.getByTestId('location-state')).not.toHaveTextContent('lessonId=42');
  });
});
