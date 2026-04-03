import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ allowedRoles, children }) {
  const auth = useAuth() || {}
  const user = auth.user ?? null
  const role = auth.role ?? null
  const loading = Boolean(auth.loading)
  const normalizedAllowedRoles = Array.isArray(allowedRoles) ? allowedRoles : []

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

  if (normalizedAllowedRoles.length > 0 && !role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F8F8] text-muted">
        Restoring session...
      </div>
    )
  }

  if (normalizedAllowedRoles.length > 0 && !normalizedAllowedRoles.includes(role)) {
    return <Navigate to="/signin" replace />
  }

  return children
}
