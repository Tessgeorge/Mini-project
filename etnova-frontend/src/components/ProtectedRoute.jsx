import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F8F8] text-muted">
        Checking access...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/signin" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/signin" replace />
  }

  return children
}
