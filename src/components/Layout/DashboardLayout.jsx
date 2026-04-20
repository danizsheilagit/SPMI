/**
 * Main application layout: Sidebar (left) + Header + Content (right)
 */
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { BreadcrumbProvider, useCrumbs } from '../../contexts/BreadcrumbContext'

function LayoutInner() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const breadcrumbs = useCrumbs()

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar collapsed={sidebarCollapsed} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header
          onToggleSidebar={() => setSidebarCollapsed(c => !c)}
          breadcrumbs={breadcrumbs}
        />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout() {
  return (
    <BreadcrumbProvider>
      <LayoutInner />
    </BreadcrumbProvider>
  )
}
