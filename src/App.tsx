import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { AdmissionsPage } from '@/pages/AdmissionsPage';
import { SubjectsPage } from '@/pages/SubjectsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import type { ReactNode } from 'react';

function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />

      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/subjects" element={<SubjectsPage />} />
        <Route path="/admissions" element={<AdmissionsPage />} />
        <Route path="/students" element={<PlaceholderPage title="Ученики" />} />
        <Route path="/parents" element={<PlaceholderPage title="Родители" />} />
        <Route path="/teachers" element={<PlaceholderPage title="Учителя" />} />
        <Route path="/schedule" element={<PlaceholderPage title="Расписание" />} />
        <Route path="/grades" element={<PlaceholderPage title="Дневник и оценки" />} />
        <Route path="/attendance" element={<PlaceholderPage title="Посещаемость (QR)" />} />
        <Route path="/ai-tests" element={<PlaceholderPage title="AI-тесты" />} />
        <Route path="/clubs" element={<PlaceholderPage title="Кружки и события" />} />
        <Route path="/service" element={<PlaceholderPage title="Сервисные заявки" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
