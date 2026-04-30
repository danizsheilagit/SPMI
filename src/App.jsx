import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/Layout/DashboardLayout'

// Core pages
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Dashboard from './pages/Dashboard'
import Unauthorized from './pages/Unauthorized'

// Admin pages
import AuditCycles          from './pages/admin/AuditCycles'
import InstrumentManagement from './pages/admin/InstrumentManagement'
import UnitManagement       from './pages/admin/UnitManagement'
import UserManagement       from './pages/admin/UserManagement'
import AuditorPlotting      from './pages/admin/AuditorPlotting'
import StandardManagement   from './pages/admin/StandardManagement'

// Auditee pages
import SelfEvaluation from './pages/auditee/SelfEvaluation'
import EvaluationForm from './pages/auditee/EvaluationForm'

// Auditor pages
import AuditorAssignments from './pages/auditor/AuditorAssignments'
import AuditorAuditDetail from './pages/auditor/AuditorAuditDetail'

// Pimpinan pages
import RTMPage   from './pages/pimpinan/RTMPage'
import RTMDetail from './pages/pimpinan/RTMDetail'

// Shared admin pages
import RTLVerification from './pages/admin/RTLVerification'
import Reports         from './pages/admin/Reports'

// Auditee pages (RTL)
import RTLPage from './pages/auditee/RTLPage'

// Announcements
import AnnouncementManagement from './pages/admin/AnnouncementManagement'
import AnnouncementsPage      from './pages/shared/AnnouncementsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public ─────────────────────────────────── */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ── Protected — authenticated users only ──────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />

              {/* ── Super Admin only ───────────────────── */}
              <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
                <Route path="/audit-cycles"     element={<AuditCycles />} />
                <Route path="/units"            element={<UnitManagement />} />
                <Route path="/users"            element={<UserManagement />} />
                <Route path="/auditor-plotting" element={<AuditorPlotting />} />
                <Route path="/reports"          element={<PlaceholderPage title="Laporan & Rekap" />} />
                <Route path="/settings"         element={<PlaceholderPage title="Pengaturan Sistem" />} />
              </Route>

              {/* ── Super Admin + Pimpinan + Kepala LPMPP ── */}
              <Route element={<ProtectedRoute allowedRoles={['super_admin', 'pimpinan', 'kepala_lpmpp']} />}>
                <Route path="/instruments" element={<InstrumentManagement />} />
              </Route>

              {/* ── Standar: Super Admin, Kepala LPMPP, Pimpinan, Auditee (auditor func), Auditor ── */}
              <Route element={<ProtectedRoute allowedRoles={['super_admin', 'kepala_lpmpp', 'pimpinan', 'auditee', 'auditor']} />}>
                <Route path="/standards" element={<StandardManagement />} />
              </Route>

              {/* ── Auditee only ───────────────────────── */}
              <Route element={<ProtectedRoute allowedRoles={['auditee']} />}>
                <Route path="/self-evaluation"                   element={<SelfEvaluation />} />
                <Route path="/self-evaluation/:unitInstrumentId" element={<EvaluationForm />} />
                <Route path="/rtl"                               element={<RTLPage />} />
                <Route path="/history"                           element={<PlaceholderPage title="Riwayat Audit" />} />
              </Route>

              {/* ── Auditor: role=auditor OR is_auditor flag ── */}
              <Route element={<ProtectedRoute allowedRoles={['auditor']} allowAuditorFunc />}>
                <Route path="/auditor/assignments"            element={<AuditorAssignments />} />
                <Route path="/auditor/audit/:unitInstrumentId" element={<AuditorAuditDetail />} />
              </Route>

              {/* ── Pimpinan only ──────────────────────── */}
              <Route element={<ProtectedRoute allowedRoles={['pimpinan']} />}>
                <Route path="/rtm"     element={<RTMPage />} />
                <Route path="/rtm/:rtmId" element={<RTMDetail />} />
                <Route path="/summary" element={<PlaceholderPage title="Ringkasan Mutu" />} />
              </Route>

              {/* ── Super Admin + Kepala LPMPP + Pimpinan ──────── */}
              <Route element={<ProtectedRoute allowedRoles={['super_admin', 'kepala_lpmpp', 'pimpinan']} />}>
                <Route path="/reports" element={<Reports />} />
              </Route>

              {/* ── Super Admin + Kepala LPMPP: Announcements ── */}
              <Route element={<ProtectedRoute allowedRoles={['super_admin', 'kepala_lpmpp']} />}>
                <Route path="/announcements/manage" element={<AnnouncementManagement />} />
              </Route>

              {/* ── Auditor + Auditee: Lihat Pengumuman ─────── */}
              <Route element={<ProtectedRoute allowedRoles={['auditor', 'auditee', 'pimpinan']} allowAuditorFunc />}>
                <Route path="/announcements" element={<AnnouncementsPage />} />
              </Route>

              {/* ── Super Admin + Auditor: Verifikasi RTL ──────── */}
              <Route element={<ProtectedRoute allowedRoles={['super_admin', 'auditor']} allowAuditorFunc />}>
                <Route path="/rtl-verification" element={<RTLVerification />} />
              </Route>
            </Route>


          </Route>

          {/* ── Fallback ───────────────────────────────── */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

function PlaceholderPage({ title }) {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="rounded-md border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-gray-700">{title}</h2>
        <p className="mt-2 text-sm text-gray-400">Halaman ini sedang dalam pengembangan — Fase berikutnya.</p>
      </div>
    </div>
  )
}
