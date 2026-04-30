/**
 * QASYS Sidebar Navigation
 * - Collapsible groups (klik header untuk hide/show)
 * - Urutan: Dashboard → Dokumen SPMI → Dokumen Pendukung → menu lainnya
 * - Collapsed mode (icon only) didukung penuh
 */
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardList, ClipboardCheck, FileText,
  BarChart3, Settings, Users, Building2, UserSearch, BookOpen,
  ChevronRight, ChevronDown, Megaphone, FolderOpen, FolderClosed,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

/* ─── Shared sub-menus ───────────────────────────────────────── */
const DOKUMEN_SPMI = {
  group: 'Dokumen SPMI',
  items: [
    { label: 'Kebijakan SPMI', to: '/dokumen/kebijakan',    icon: BookOpen },
    { label: 'Manual/Pedoman', to: '/dokumen/manual',       icon: BookOpen },
    { label: 'Standar SPMI',   to: '/dokumen/standar-spmi', icon: BookOpen },
    { label: 'Instrumen SPMI', to: '/dokumen/instrumen',    icon: FileText },
    { label: 'SOP',            to: '/dokumen/sop',          icon: FileText },
  ],
}
const DOKUMEN_PENDUKUNG = {
  group: 'Dokumen Pendukung',
  items: [
    { label: 'Pendidikan',   to: '/dokumen/pendidikan',  icon: FileText },
    { label: 'Penelitian',   to: '/dokumen/penelitian',  icon: FileText },
    { label: 'Pengabdian',   to: '/dokumen/pengabdian',  icon: FileText },
    { label: 'Non SN-Dikti', to: '/dokumen/non-sndikti', icon: FileText },
  ],
}

/* ─── Menu Config (Dashboard → Dokumen → menu lainnya) ───────── */
const menuConfig = {
  super_admin: [
    { group: null, items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }] },
    DOKUMEN_SPMI,
    DOKUMEN_PENDUKUNG,
    {
      group: 'Mutu & Audit',
      items: [
        { label: 'Siklus Audit',     to: '/audit-cycles',     icon: ClipboardList },
        { label: 'Instrumen AMI',    to: '/instruments',      icon: FileText },
        { label: 'Unit & Prodi',     to: '/units',            icon: Building2 },
        { label: 'Plotting Auditor', to: '/auditor-plotting', icon: UserSearch },
      ],
    },
    {
      group: 'Administrasi',
      items: [
        { label: 'Manajemen Pengguna', to: '/users',                icon: Users         },
        { label: 'Pengumuman',         to: '/announcements/manage', icon: Megaphone     },
        { label: 'Verifikasi RTL',     to: '/rtl-verification',     icon: ClipboardCheck},
        { label: 'Laporan & Rekap',    to: '/reports',              icon: BarChart3     },
        { label: 'Pengaturan',         to: '/settings',             icon: Settings      },
      ],
    },
  ],

  kepala_lpmpp: [
    { group: null, items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }] },
    DOKUMEN_SPMI,
    DOKUMEN_PENDUKUNG,
    {
      group: 'Administrasi',
      items: [
        { label: 'Instrumen AMI',   to: '/instruments',            icon: ClipboardList },
        { label: 'Pengumuman',      to: '/announcements/manage',   icon: Megaphone     },
        { label: 'Laporan & Rekap', to: '/reports',                icon: BarChart3     },
      ],
    },
  ],

  auditee: [
    { group: null, items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }] },
    DOKUMEN_SPMI,
    DOKUMEN_PENDUKUNG,
    {
      group: 'Evaluasi',
      items: [
        { label: 'Evaluasi Diri',         to: '/self-evaluation', icon: ClipboardList },
        { label: 'Rencana Tindak Lanjut', to: '/rtl',             icon: FileText      },
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
    { group: null, items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }] },
    DOKUMEN_SPMI,
    DOKUMEN_PENDUKUNG,
    {
      group: 'Audit',
      items: [
        { label: 'Penugasan Audit', to: '/auditor/assignments', icon: ClipboardCheck },
        { label: 'Verifikasi RTL',  to: '/rtl-verification',    icon: ClipboardList  },
      ],
    },
  ],

  pimpinan: [
    { group: null, items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }] },
    DOKUMEN_SPMI,
    DOKUMEN_PENDUKUNG,
    {
      group: 'AMI',
      items: [
        { label: 'Rapat Tinjau Manajemen', to: '/rtm',     icon: ClipboardList },
        { label: 'Laporan & Rekap',        to: '/reports', icon: BarChart3     },
      ],
    },
  ],
}

const roleLabels = {
  super_admin:  'Super Admin',
  kepala_lpmpp: 'Kepala LPMPP',
  auditee:      'Auditee',
  auditor:      'Auditor',
  pimpinan:     'Pimpinan',
}

/* ─── Sidebar ───────────────────────────────────────────────── */
export default function Sidebar({ collapsed = false }) {
  const { profile, role, isAuditorFunc, signOut } = useAuth()
  const location = useLocation()

  // collapsedGroups: set of group names yang di-hide
  const [collapsedGroups, setCollapsedGroups] = useState(
    new Set(['Dokumen SPMI', 'Dokumen Pendukung'])
  )

  function toggleGroup(groupName) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(groupName) ? next.delete(groupName) : next.add(groupName)
      return next
    })
  }

  // Bangun menu dari role
  let groups = menuConfig[role] || []

  // Auditee yang juga auditor: tambah grup Audit
  if (isAuditorFunc && !groups.some(g => g.group === 'Audit')) {
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

  return (
    <aside
      className={`flex flex-col bg-gray-900 text-white transition-all duration-300 shrink-0 ${
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
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-700">
        {groups.map((group, gi) => {
          const isGroupCollapsed = group.group && collapsedGroups.has(group.group)
          // Apakah ada item aktif di grup ini
          const hasActiveItem = (group.items || []).some(
            item => location.pathname === item.to || location.pathname.startsWith(item.to + '/')
          )

          return (
            <div key={gi} className={gi === 0 ? '' : ''}>

              {/* ── Group header (collapsible) ── */}
              {group.group && !collapsed && (
                <button
                  onClick={() => toggleGroup(group.group)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md mb-0.5 transition-colors group
                    ${hasActiveItem
                      ? 'text-blue-400 hover:bg-gray-800'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    {group.group === 'Dokumen SPMI' || group.group === 'Dokumen Pendukung'
                      ? (isGroupCollapsed
                          ? <FolderClosed className="h-3 w-3" />
                          : <FolderOpen className="h-3 w-3" />)
                      : null
                    }
                    <span className="text-[10px] font-semibold uppercase tracking-widest">
                      {group.group}
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-3 w-3 transition-transform duration-200 ${
                      isGroupCollapsed ? '-rotate-90' : 'rotate-0'
                    }`}
                  />
                </button>
              )}

              {/* Collapsed sidebar: divider saja */}
              {group.group && collapsed && (
                <div className="my-2 border-t border-gray-800/60" />
              )}

              {/* ── Items ── */}
              {!isGroupCollapsed && (
                <div
                  className={`space-y-0.5 overflow-hidden transition-all duration-200 ${
                    group.group && !collapsed ? 'pl-1' : ''
                  }`}
                >
                  {(group.items || []).map(item => {
                    const Icon = item.icon
                    const isActive =
                      location.pathname === item.to ||
                      location.pathname.startsWith(item.to + '/')

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        title={collapsed ? item.label : undefined}
                        className={`
                          flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
                          transition-colors duration-150 group
                          ${isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                          }
                        `}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'
                        }`} />
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
              )}
            </div>
          )
        })}
      </nav>

      {/* ── Sign Out ──────────────────────────────────────── */}
      <div className="px-2 pb-4 border-t border-gray-800 pt-3">
        <button
          onClick={signOut}
          title={collapsed ? 'Keluar' : undefined}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm
            text-gray-400 hover:text-white hover:bg-gray-800 transition-colors duration-150"
        >
          <LogOut className="w-4 h-4 shrink-0 text-gray-500" />
          {!collapsed && <span>Keluar</span>}
        </button>
      </div>
    </aside>
  )
}
