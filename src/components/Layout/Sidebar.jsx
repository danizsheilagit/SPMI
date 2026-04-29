/**
 * QASYS Sidebar Navigation
 * Grouped menu sections per role for better structure
 */
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ClipboardList,
  ClipboardCheck,
  FileText,
  BarChart3,
  Settings,
  Users,
  Building2,
  UserSearch,
  BookOpen,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

/* ─── Menu Config (dikelompokkan per seksi) ─────────────────── */
const menuConfig = {
  super_admin: [
    {
      group: null,
      items: [
        { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'Mutu & Audit',
      items: [
        { label: 'Siklus Audit',     to: '/audit-cycles',     icon: ClipboardList },
        { label: 'Instrumen',        to: '/instruments',      icon: FileText },
        { label: 'Standar',          to: '/standards',        icon: BookOpen },
        { label: 'Unit & Prodi',     to: '/units',            icon: Building2 },
        { label: 'Plotting Auditor', to: '/auditor-plotting', icon: UserSearch },
      ],
    },
    {
      group: 'Administrasi',
      items: [
        { label: 'Manajemen Pengguna', to: '/users',              icon: Users     },
        { label: 'Verifikasi RTL',     to: '/rtl-verification',   icon: ClipboardCheck },
        { label: 'Laporan & Rekap',    to: '/reports',            icon: BarChart3 },
        { label: 'Pengaturan',         to: '/settings',           icon: Settings  },
      ],
    },
  ],

  kepala_lpmpp: [
    {
      group: null,
      items: [
        { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'Referensi',
      items: [
        { label: 'Instrumen', to: '/instruments', icon: FileText },
        { label: 'Standar',   to: '/standards',   icon: BookOpen },
      ],
    },
    {
      group: 'Laporan',
      items: [
        { label: 'Laporan & Rekap', to: '/reports', icon: BarChart3 },
      ],
    },
  ],

  auditee: [
    {
      group: null,
      items: [
        { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'Evaluasi',
      items: [
        { label: 'Evaluasi Diri',          to: '/self-evaluation', icon: ClipboardList },
        { label: 'Rencana Tindak Lanjut',  to: '/rtl',             icon: FileText },
      ],
    },
    {
      group: 'Riwayat',
      items: [
        { label: 'Riwayat Audit', to: '/history', icon: BarChart3 },
      ],
    },
  ],

  auditor: [
    {
      group: null,
      items: [
        { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'Audit',
      items: [
        { label: 'Penugasan Audit', to: '/auditor/assignments',  icon: ClipboardCheck },
        { label: 'Verifikasi RTL',  to: '/rtl-verification',     icon: ClipboardList  },
      ],
    },
    {
      group: 'Referensi',
      items: [
        { label: 'Standar', to: '/standards', icon: BookOpen },
      ],
    },
  ],

  pimpinan: [
    {
      group: null,
      items: [
        { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'AMI',
      items: [
        { label: 'Rapat Tinjau Manajemen', to: '/rtm',     icon: ClipboardList },
        { label: 'Laporan & Rekap',        to: '/reports', icon: BarChart3     },
      ],
    },
    {
      group: 'Referensi',
      items: [
        { label: 'Instrumen', to: '/instruments', icon: FileText },
        { label: 'Standar',   to: '/standards',   icon: BookOpen },
      ],
    },
  ],
}

const roleLabels = {
  super_admin:  'Super Admin',
  kepala_lpmpp: 'Kepala LPMPP',
  auditee:      'Auditee',
  pimpinan:     'Pimpinan',
}

/* ─── Sidebar ───────────────────────────────────────────────── */
export default function Sidebar({ collapsed = false }) {
  const { profile, role, isAuditorFunc, signOut } = useAuth()
  const location = useLocation()

  // Grup menu dari role
  let groups = menuConfig[role] || []

  // Auditee + fungsi auditor → tambah Standar + Penugasan Audit + Verifikasi RTL
  if (role === 'auditee' && isAuditorFunc) {
    groups = groups.map(g =>
      g.group === 'Evaluasi'
        ? { ...g, items: [...g.items, { label: 'Standar', to: '/standards', icon: BookOpen }] }
        : g
    )
    // Tambah grup Audit jika belum ada
    if (!groups.some(g => g.group === 'Audit')) {
      groups = [
        ...groups,
        {
          group: 'Audit',
          items: [
            { label: 'Penugasan Audit', to: '/auditor/assignments', icon: ClipboardCheck },
            { label: 'Verifikasi RTL',  to: '/rtl-verification',    icon: ClipboardList  },
          ],
        },
      ]
    }
  }

  return (
    <aside
      className={`flex flex-col bg-gray-900 text-white transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      } min-h-screen`}
    >
      {/* ── Logo / Brand ──────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-800">
        <img
          src="/logo-sys.png"
          alt="STIKOM Yos Sudarso"
          className={`object-contain shrink-0 ${collapsed ? 'w-8 h-8' : 'w-10 h-10'}`}
        />
        {!collapsed && (
          <div>
            <span className="text-base font-bold tracking-wide text-white">QASYS</span>
            <p className="text-[10px] text-gray-400 leading-tight">SPMI · STIKOM Yos Sudarso</p>
          </div>
        )}
      </div>

      {/* ── Role Badge ────────────────────────────────────── */}
      {!collapsed && role && (
        <div className="mx-3 mt-3 mb-1 px-3 py-1.5 rounded bg-blue-900/40 border border-blue-800/60">
          <p className="text-[11px] text-blue-300 font-medium">{roleLabels[role] ?? role}</p>
          <p className="text-[10px] text-gray-400 truncate">{profile?.full_name ?? profile?.email ?? '—'}</p>
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {groups.map((group, gi) => (
          <div key={gi} className={gi === 0 ? '' : 'mt-3'}>
            {/* Group label */}
            {group.group && !collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                {group.group}
              </p>
            )}
            {group.group && collapsed && (
              <div className="my-2 border-t border-gray-800/60" />
            )}

            {/* Items */}
            <div className="space-y-0.5">
              {(group.items || []).map(item => {
                const Icon = item.icon
                const isActive =
                  location.pathname === item.to ||
                  location.pathname.startsWith(item.to + '/')

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
                      transition-colors duration-150 group
                      ${isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-200" />}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Sign Out ──────────────────────────────────────── */}
      <div className="px-2 pb-4 border-t border-gray-800 pt-3">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm
            text-gray-400 hover:text-white hover:bg-gray-800 transition-colors duration-150"
        >
          <svg className="w-4 h-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
          </svg>
          {!collapsed && <span>Keluar</span>}
        </button>
      </div>
    </aside>
  )
}
