import { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import supabase from './config/supabaseClient'

const SignIn = lazy(() => import('./pages/SignIn'))
const MentorDashboard = lazy(() => import('./pages/MentorDashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminGuideAllocation = lazy(() => import('./pages/AdminGuideAllocation'))
const AdminMentorManagement = lazy(() => import('./pages/AdminMentorManagement'))
const AdminReviewManagement = lazy(() => import('./pages/AdminReviewManagement'))
const AdminClasses = lazy(() => import('./pages/AdminClasses'))
const AdminReviewStages = lazy(() => import('./pages/AdminReviewStages'))
const StudentLayout = lazy(() => import('./components/StudentLayout'))

function StudentRouteWrapper() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      localStorage.removeItem('studentView'); // Reset to dashboard on next login
      await supabase.auth.signOut();
      navigate('/signin');
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
          <Route
            path="/student"
            element={<StudentRouteWrapper />}
          />
          <Route
            path="/mentor"
            element={
              <ProtectedRoute allowedRoles={['mentor']}>
                <MentorDashboard />
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
            path="/admin/review-stages"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminReviewStages />
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
