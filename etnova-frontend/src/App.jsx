import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import SignIn from './pages/SignIn'
import MentorDashboard from './pages/MentorDashboard'
import AdminDashboard from './pages/AdminDashboard'
import ProtectedRoute from './components/ProtectedRoute'
import StudentLayout from './components/StudentLayout'
import supabase from './config/supabaseClient'

function StudentRouteWrapper() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
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
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    </Router>
  )
}

export default App
