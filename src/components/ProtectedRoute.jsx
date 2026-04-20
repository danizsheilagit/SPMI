/**
 * RBAC Route Guard
 * Wraps routes that require authentication and specific roles.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { isAuthenticated, role, loading } = useAuth()
  const location = useLocation()

  // Show full-page spinner ONLY while auth is being determined
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Memuat sistem...</p>
        </div>
      </div>
    )
  }

  // Not logged in → redirect to login and remember where they wanted to go
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // No role requirement → just auth check (outer wrapper)
  if (allowedRoles.length === 0) return <Outlet />

  // Role not loaded yet (profile fetch still pending/failed) → render anyway
  // Individual pages can show role-appropriate content
  if (!role) return <Outlet />

  // Wrong role → unauthorized
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
