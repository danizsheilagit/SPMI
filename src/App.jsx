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

              {/* ── Standar: Super Admin, Kepala LPMPP, Pimpinan, Auditee (auditor func) ── */}
              <Route element={<ProtectedRoute allowedRoles={['super_admin', 'kepala_lpmpp', 'pimpinan', 'auditee']} />}>
                <Route path="/standards" element={<StandardManagement />} />
              </Route>

              {/* ── Auditee only ───────────────────────── */}
              <Route element={<ProtectedRoute allowedRoles={['auditee']} />}>
                <Route path="/self-evaluation"                   element={<SelfEvaluation />} />
                <Route path="/self-evaluation/:unitInstrumentId" element={<EvaluationForm />} />
                <Route path="/rtl"                               element={<PlaceholderPage title="Rencana Tindak Lanjut" />} />
                <Route path="/history"                           element={<PlaceholderPage title="Riwayat Audit" />} />
              </Route>

              {/* ── Auditor only ───────────────────────── */}
              <Route element={<ProtectedRoute allowedRoles={['auditor']} />}>
                <Route path="/assignments"   element={<PlaceholderPage title="Penugasan Audit" />} />
                <Route path="/findings"      element={<PlaceholderPage title="Temuan Audit" />} />
                <Route path="/audit-reports" element={<PlaceholderPage title="Laporan Audit" />} />
              </Route>

              {/* ── Pimpinan only ──────────────────────── */}
              <Route element={<ProtectedRoute allowedRoles={['pimpinan']} />}>
                <Route path="/summary"       element={<PlaceholderPage title="Ringkasan Mutu" />} />
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
