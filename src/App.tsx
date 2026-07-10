import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { EntranceFlow } from '@/pages/entrance/EntranceFlow';
import { AdmissionsPage } from '@/pages/AdmissionsPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { SubjectsPage } from '@/pages/SubjectsPage';
import { SubjectMaterialsPage } from '@/pages/SubjectMaterialsPage';
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
      {/* Public applicant flow (Sprint 2A) — no admin auth, its own responsive layout. */}
      <Route path="/entrance" element={<EntranceFlow />} />

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
        <Route path="/subjects/:subjectId/materials" element={<SubjectMaterialsPage />} />
        <Route path="/admissions" element={<AdmissionsPage />} />
        <Route path="/review" element={<ReviewPage />} />
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
