import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import AuthPage from './pages/AuthPage';
import StudentDashboard from './pages/student/StudentDashboard';
import CourseViewPage from './pages/student/CourseViewPage';
import LessonPage from './pages/student/LessonPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import NewCoursePage from './pages/admin/NewCoursePage';
import CourseManagerPage from './pages/admin/CourseManagerPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';

function AuthRoute() {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={isAdmin ? '/admin' : '/'} replace />;
  return <AuthPage />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthRoute />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<StudentDashboard />} />
        <Route path="/courses/:courseId" element={<CourseViewPage />} />
        <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonPage />} />
      </Route>

      <Route element={<ProtectedRoute requireAdmin><AppLayout /></ProtectedRoute>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/courses/new" element={<NewCoursePage />} />
        <Route path="/admin/courses/:courseId" element={<CourseManagerPage />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
        <Route path="/admin/preview/courses/:courseId/lessons/:lessonId" element={<LessonPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
