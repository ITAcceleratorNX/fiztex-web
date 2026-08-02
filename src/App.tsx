import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { EntranceFlow } from '@/pages/entrance/EntranceFlow';
import { AdmissionsPage } from '@/pages/AdmissionsPage';
import { TestDetailPage } from '@/pages/TestDetailPage';
import { TestCreatePage } from '@/pages/TestCreatePage';
import { ResultsPage } from '@/pages/ResultsPage';
import { ResultReviewPage } from '@/pages/ResultReviewPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { SubjectMaterialsPage } from '@/pages/SubjectMaterialsPage';
import { AiTestsPage } from '@/pages/AiTestsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import {
  UsersPage,
  ClassesPage,
  ClassDetailPage,
  AcademicYearPage,
  PeriodsPage,
  AccessCodesPage,
  ImportPage,
  ScheduleSettingsPage,
  StudentsPage,
  ParentsPage,
  TeachersPage,
  StudentProfilePage,
  ParentProfilePage,
  TeacherProfilePage,
  SchoolSubjectsPage,
  LessonSchedulePage,
  LessonCardPage,
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
        <Route path="/admin/classes/:classId" element={<ClassDetailPage />} />
        <Route path="/admin/academic-year" element={<AcademicYearPage />} />
        <Route path="/admin/periods" element={<PeriodsPage />} />
        {/* Раздел переехал в подстраницы «Расписания» — оставлен редирект для старых ссылок. */}
        <Route
          path="/admin/schedule-settings"
          element={<Navigate to="/lesson-schedule/bell-templates" replace />}
        />
        <Route path="/admin/school-subjects" element={<SchoolSubjectsPage />} />
        <Route path="/admin/access-codes" element={<AccessCodesPage />} />
        <Route path="/admin/import" element={<ImportPage />} />

        {/* Admissions & school modules */}
        {/* Subjects are now a tab inside Вступительные тесты; keep the path as a deep link. */}
        <Route path="/subjects" element={<Navigate to="/admin/school-subjects" replace />} />
        <Route path="/subjects/:subjectId/materials" element={<SubjectMaterialsPage />} />
        <Route path="/admissions" element={<AdmissionsPage />} />
        <Route path="/admissions/tests/new" element={<TestCreatePage />} />
        <Route path="/admissions/tests/:testId" element={<TestDetailPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/results/attempts/:attemptId" element={<ResultReviewPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/students/:accountId" element={<StudentProfilePage />} />
        <Route path="/parents" element={<ParentsPage />} />
        <Route path="/parents/:accountId" element={<ParentProfilePage />} />
        <Route path="/teachers" element={<TeachersPage />} />
        <Route path="/teachers/:accountId" element={<TeacherProfilePage />} />
        <Route path="/schedule" element={<Navigate to="/lesson-schedule" replace />} />
        <Route path="/lesson-schedule" element={<LessonSchedulePage />} />
        <Route path="/lesson-schedule/lessons/:lessonId" element={<LessonCardPage />} />
        <Route
          path="/lesson-schedule/bell-templates"
          element={<ScheduleSettingsPage section="templates" />}
        />
        <Route
          path="/lesson-schedule/calendar"
          element={<ScheduleSettingsPage section="calendar" />}
        />
        <Route
          path="/lesson-schedule/teachers"
          element={<ScheduleSettingsPage section="teachers" />}
        />
        <Route
          path="/lesson-schedule/subgroups"
          element={<ScheduleSettingsPage section="subgroups" />}
        />
        <Route
          path="/grades"
          element={
            <PlaceholderPage
              title="Дневник и оценки"
              reason="Backend API для оценок ещё не реализован. Эндпойнтов нет."
            />
          }
        />
        <Route
          path="/attendance"
          element={
            <PlaceholderPage
              title="Посещаемость (QR)"
              reason="Backend API для посещаемости ещё не реализован. Эндпойнтов нет."
            />
          }
        />
        <Route path="/ai-tests" element={<AiTestsPage />} />
        <Route
          path="/clubs"
          element={
            <PlaceholderPage
              title="Кружки и события"
              reason="Backend API для кружков ещё не реализован. Эндпойнтов нет."
            />
          }
        />
        <Route
          path="/service"
          element={
            <PlaceholderPage
              title="Сервисные заявки"
              reason="Backend API для сервисных заявок ещё не реализован. Эндпойнтов нет."
            />
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
