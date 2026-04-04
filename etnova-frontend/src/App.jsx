import { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import supabase from './config/supabaseClient'

const SignIn = lazy(() => import('./pages/SignIn'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const RoleHelpSupport = lazy(() => import('./pages/RoleHelpSupport'))
const MentorDashboard = lazy(() => import('./pages/MentorDashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminGuideAllocation = lazy(() => import('./pages/AdminGuideAllocation'))
const AdminMentorManagement = lazy(() => import('./pages/AdminMentorManagement'))
const AdminReviewManagement = lazy(() => import('./pages/AdminReviewManagement'))
const AdminRubrics = lazy(() => import('./pages/AdminRubrics'))
const AdminClasses = lazy(() => import('./pages/AdminClasses'))
const StudentLayout = lazy(() => import('./components/StudentLayout'))
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'))
const IdeaWorkspace = lazy(() => import('./pages/IdeaWorkspace'))
const MyProject = lazy(() => import('./pages/MyProject'))
const MyTeam = lazy(() => import('./pages/MyTeam'))
const Submissions = lazy(() => import('./pages/Submissions'))
const Marks = lazy(() => import('./pages/Marks'))
const StudentDiscussion = lazy(() => import('./pages/StudentDiscussion'))

function StudentRouteWrapper() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/signin', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['student']}>
      <StudentLayout onLogout={handleLogout} />
    </ProtectedRoute>
  );
}

function App() {
  return (
    <Router>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-slate-600">
            Loading...
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Navigate to="/signin" replace />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/student"
            element={<StudentRouteWrapper />}
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="ideas" element={<IdeaWorkspace />} />
            <Route path="chat" element={<StudentDiscussion />} />
            <Route path="help" element={<RoleHelpSupport role="student" />} />
            <Route path="submissions" element={<Submissions />} />
            <Route path="profile" element={<MyProject />} />

            <Route path="team" element={<MyTeam />} />
            <Route path="marks" element={<Marks />} />

            {/* Backward-compatible aliases */}
            <Route path="project" element={<Navigate to="/student/profile" replace />} />
            <Route path="discussion" element={<Navigate to="/student/chat" replace />} />
          </Route>
          <Route
            path="/mentor"
            element={
              <ProtectedRoute allowedRoles={['mentor']}>
                <MentorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mentor/help"
            element={
              <ProtectedRoute allowedRoles={['mentor']}>
                <RoleHelpSupport role="mentor" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/help"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <RoleHelpSupport role="admin" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/guide-allocation"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminGuideAllocation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/mentor-management"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminMentorManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/review-management"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminReviewManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/rubrics"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminRubrics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/review-stages"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Navigate to="/admin/review-management" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/classes"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminClasses />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/signin" replace />} />
        </Routes>
      </Suspense>
    </Router>
  )
}

export default App
