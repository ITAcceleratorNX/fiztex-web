import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { EntranceFlow } from '@/pages/entrance/EntranceFlow';
import { PublicAnnouncementsPage } from '@/pages/public/PublicAnnouncementsPage';
import { PublicAnnouncementPage } from '@/pages/public/PublicAnnouncementPage';
import { PrivacyPolicyPage } from '@/pages/public/PrivacyPolicyPage';
import { ROUTES, isRouteAllowedForRole, landingRouteForRole } from '@/lib/routes';
import { AdmissionsPage } from '@/pages/AdmissionsPage';
import { TestDetailPage } from '@/pages/TestDetailPage';
import { TestCreatePage } from '@/pages/TestCreatePage';
import { TestQuestionsPage } from '@/pages/TestQuestionsPage';
import { ResultsPage } from '@/pages/ResultsPage';
import { ResultReviewPage } from '@/pages/ResultReviewPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { SubjectMaterialsPage } from '@/pages/SubjectMaterialsPage';
import { AiTestsPage } from '@/pages/AiTestsPage';
import { HomeworkListPage } from '@/pages/homework/HomeworkListPage';
import { HomeworkCardPage } from '@/pages/homework/HomeworkCardPage';
import { HomeworkFormPage } from '@/pages/homework/HomeworkFormPage';
import { SubmissionReviewPage } from '@/pages/homework/SubmissionReviewPage';
import { LessonHomeworkPage } from '@/pages/homework/LessonHomeworkPage';
import { MySchedulePage } from '@/pages/schedule/MySchedulePage';
import { HomeworkGroupsPage } from '@/pages/homework/HomeworkGroupsPage';
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
  LessonAttendancePage,
} from '@/platform';
import type { ReactNode } from 'react';

function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated, admin } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.staffLogin} replace state={{ from: location.pathname }} />;
  }
  // Чужой раздел разворачиваем сами: под учителем админский экран ответил бы 401,
  // а тот трактуется как истёкшая сессия — вместо «сюда нельзя» был бы выход из системы.
  if (!isRouteAllowedForRole(location.pathname, admin?.role)) {
    return <Navigate to={landingRouteForRole(admin?.role)} replace />;
  }
  return <>{children}</>;
}

export function App() {
  const { isAuthenticated, admin } = useAuth();

  return (
    <Routes>
      {/*
        Публичная зона: открывается без входа. Главная отдана разделу вступительных
        тестов — с неё поступающий читает анонс и уходит вводить персональный код.
      */}
      <Route path={ROUTES.publicAnnouncements} element={<PublicAnnouncementsPage />} />
      <Route path="/announcements/:announcementId" element={<PublicAnnouncementPage />} />
      <Route path={ROUTES.entrance} element={<EntranceFlow />} />
      {/* Политику читают до входа — маршрут публичный. */}
      <Route path={ROUTES.privacy} element={<PrivacyPolicyPage />} />

      {/*
        Вход администратора на отдельном пути: на главной его больше нет.
        Редиректа со старого `/login` намеренно нет — его ловит `*` и уводит
        на публичную главную.
      */}
      {/*
        Уже вошедшему форма входа не нужна — но уводить его надо по роли. Этот редирект
        срабатывает сразу после успешного входа (состояние меняется, маршрут
        перерисовывается) и перебивает любой `navigate` из самой формы, поэтому правило
        обязано жить и здесь тоже, иначе учитель всё равно попадёт на админский дашборд
        и будет разлогинен первым же 401.
      */}
      <Route
        path={ROUTES.staffLogin}
        element={
          isAuthenticated ? (
            <Navigate to={landingRouteForRole(admin?.role)} replace />
          ) : (
            <LoginPage />
          )
        }
      />

      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path={ROUTES.dashboard} element={<DashboardPage />} />

        {/* Platform Core Lite */}
        <Route path="/admin" element={<Navigate to={ROUTES.dashboard} replace />} />
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
        {/* Shared by admission and AI tests — both edit the same Test/Question model. */}
        <Route path="/tests/:testId/questions" element={<TestQuestionsPage />} />
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
        {/* Своё расписание учителя: ролевой экран, из него открывается урок. */}
        <Route path={ROUTES.mySchedule} element={<MySchedulePage />} />
        <Route path="/lesson-schedule" element={<LessonSchedulePage />} />
        <Route path="/lesson-schedule/lessons/:lessonId" element={<LessonCardPage />} />
        {/* Лист посещаемости вложен в урок, потому что без урока не существует:
            он заводится не для расписания, а для конкретного LessonInstance. */}
        <Route
          path="/lesson-schedule/lessons/:lessonId/attendance"
          element={<LessonAttendancePage />}
        />
        {/* ДЗ урока — вход в создание из урока (FE-Teacher-002 §2.1). */}
        <Route
          path="/lesson-schedule/lessons/:lessonId/homework"
          element={<LessonHomeworkPage />}
        />
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
        <Route path="/homework" element={<HomeworkListPage />} />
        {/* Форма одна на создание из урока (?lessonId=) и вне урока (FE-Teacher-002 §2.3). */}
        <Route path="/homework/new" element={<HomeworkFormPage mode="create" />} />
        {/* Временные группы — деление класса, HOMEWORK-002 §5. */}
        <Route path="/homework/groups" element={<HomeworkGroupsPage />} />
        <Route path="/homework/:homeworkId" element={<HomeworkCardPage />} />
        <Route path="/homework/:homeworkId/edit" element={<HomeworkFormPage mode="edit" />} />
        <Route
          path="/homework/:homeworkId/students/:studentProfileId"
          element={<SubmissionReviewPage />}
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

      {/* Неизвестный путь ведёт на публичную главную, а не на форму входа. */}
      <Route path="*" element={<Navigate to={ROUTES.publicAnnouncements} replace />} />
    </Routes>
  );
}
