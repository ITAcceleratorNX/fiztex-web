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
  AdminLayout,
  AdminDashboardPage,
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
      {/* Public applicant flow — separate from Platform Core / Admissions admin. */}
      <Route path="/entrance" element={<EntranceFlow />} />

      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/admin" replace /> : <LoginPage />}
      />

      {/* PHYCORE-003: Platform Core Lite admin shell */}
      <Route
        path="/admin"
        element={
          <Protected>
            <AdminLayout />
          </Protected>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="academic-year" element={<AcademicYearPage />} />
        <Route path="periods" element={<PeriodsPage />} />
        <Route path="schedule-settings" element={<ScheduleSettingsPage />} />
        <Route path="access-codes" element={<AccessCodesPage />} />
        <Route path="import" element={<ImportPage />} />
      </Route>

      {/* Scope 1: Admissions Testing admin (untouched by PHYCORE-003 pages) */}
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
        <Route path="/ai-tests" element={<AiTestsPage />} />
        <Route path="/clubs" element={<PlaceholderPage title="Кружки и события" />} />
        <Route path="/service" element={<PlaceholderPage title="Сервисные заявки" />} />
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
