import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { EntranceFlow } from '@/pages/entrance/EntranceFlow';
import { AdmissionsPage } from '@/pages/AdmissionsPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { SubjectsPage } from '@/pages/SubjectsPage';
import { SubjectMaterialsPage } from '@/pages/SubjectMaterialsPage';
import { AiTestsPage } from '@/pages/AiTestsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import {
  UsersPage,
  ClassesPage,
  AcademicYearPage,
  PeriodsPage,
  AccessCodesPage,
  ImportPage,
  ScheduleSettingsPage,
} from '@/platform';
import type { ReactNode } from 'react';

function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
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

        {/* Platform Core Lite */}
        <Route path="/admin" element={<Navigate to="/" replace />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/classes" element={<ClassesPage />} />
        <Route path="/admin/academic-year" element={<AcademicYearPage />} />
        <Route path="/admin/periods" element={<PeriodsPage />} />
        <Route path="/admin/schedule-settings" element={<ScheduleSettingsPage />} />
        <Route path="/admin/access-codes" element={<AccessCodesPage />} />
        <Route path="/admin/import" element={<ImportPage />} />

        {/* Admissions & school modules */}
        <Route path="/subjects" element={<SubjectsPage />} />
        <Route path="/subjects/:subjectId/materials" element={<SubjectMaterialsPage />} />
        <Route path="/admissions" element={<AdmissionsPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/students" element={<PlaceholderPage title="Ученики" />} />
        <Route path="/parents" element={<PlaceholderPage title="Родители" />} />
        <Route path="/teachers" element={<PlaceholderPage title="Учителя" />} />
        <Route path="/schedule" element={<Navigate to="/admin/schedule-settings" replace />} />
        <Route path="/lesson-schedule" element={<PlaceholderPage title="Расписание уроков" />} />
        <Route path="/grades" element={<PlaceholderPage title="Дневник и оценки" />} />
        <Route path="/attendance" element={<PlaceholderPage title="Посещаемость (QR)" />} />
        <Route path="/ai-tests" element={<AiTestsPage />} />
        <Route path="/clubs" element={<PlaceholderPage title="Кружки и события" />} />
        <Route path="/service" element={<PlaceholderPage title="Сервисные заявки" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
