/**
 * QASYS Top Header with Breadcrumbs
 */
import { Menu, Bell, ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function Header({ onToggleSidebar, breadcrumbs = [] }) {
  const { profile } = useAuth()

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
      {/* Hamburger toggle */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 -ml-1 text-gray-500 rounded-md hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
        <Link to="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
          <Home className="w-3.5 h-3.5" />
        </Link>
        {breadcrumbs.map((crumb, idx) => (
          <span key={idx} className="flex items-center gap-1.5 min-w-0">
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            {crumb.to ? (
              <Link
                to={crumb.to}
                className="text-gray-500 hover:text-gray-700 transition-colors truncate"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-gray-900 font-medium truncate">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button className="relative p-2 text-gray-400 rounded-md hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-800 leading-tight">
              {profile?.full_name ?? 'Pengguna'}
            </p>
            <p className="text-xs text-gray-400 leading-tight">
              {profile?.unit_name ?? '—'}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
