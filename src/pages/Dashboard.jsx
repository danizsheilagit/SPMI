/**
 * Dashboard — Data real dari Supabase.
 * Super Admin: stats sistem + login terbaru + penugasan terbaru.
 * Auditee/Auditor: data sesuai unit & siklus aktif.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { SkeletonDashboard } from '../components/UI/Skeleton'
import {
  ClipboardList, Users, Building2, CalendarCheck,
  UserCheck, Link2, Clock, LogIn,
} from 'lucide-react'

/* ─── Helpers ───────────────────────────────────────────────── */
function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2)   return 'Baru saja'
  if (m < 60)  return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h} jam lalu`
  const d = Math.floor(h / 24)
  if (d < 30)  return `${d} hari lalu`
  return new Date(dateStr).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })
}

function Avatar({ user }) {
  if (user.avatar_url)
    return <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
  const initials = (user.full_name || user.email || '?')
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold shrink-0">
      {initials}
    </div>
  )
}

/* ─── Stat Card ─────────────────────────────────────────────── */
function StatCard({ label, value, sub, color = 'blue', icon: Icon }) {
  const colorMap = {
    blue:  'text-blue-600  bg-blue-50',
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    red:   'text-red-600   bg-red-50',
    teal:  'text-teal-600  bg-teal-50',
    purple:'text-purple-600 bg-purple-50',
  }
  return (
    <div className="flex items-center gap-4 rounded-md border border-gray-200 bg-white p-5 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorMap[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ─── Role badges ───────────────────────────────────────────── */
const ROLE_LABELS = {
  super_admin:  'Super Admin',
  kepala_lpmpp: 'Kepala LPMPP',
  auditee:      'Auditee',
  auditor:      'Auditor',
  pimpinan:     'Pimpinan',
}
const ROLE_COLORS = {
  super_admin:  'bg-purple-100 text-purple-700',
  kepala_lpmpp: 'bg-teal-100   text-teal-700',
  auditee:      'bg-blue-100   text-blue-700',
  auditor:      'bg-green-100  text-green-700',
  pimpinan:     'bg-amber-100  text-amber-700',
}

/* ─── Main ──────────────────────────────────────────────────── */
export default function Dashboard() {
  const { profile, role } = useAuth()

  const [stats,       setStats]       = useState(null)
  const [logins,      setLogins]      = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading,     setLoading]     = useState(true)

  const isSuperOrLpmpp = role === 'super_admin' || role === 'kepala_lpmpp'

  const roleLabel = ROLE_LABELS[role] ?? role

  useEffect(() => { fetchAll() }, [role]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true)
    try {
      const tasks = [supabase.rpc('get_dashboard_stats')]
      if (isSuperOrLpmpp) {
        tasks.push(supabase.rpc('get_recent_user_activity', { p_limit: 6 }))
        tasks.push(supabase.rpc('get_recent_assignments',   { p_limit: 5 }))
      }
      const [statsRes, loginsRes, assignRes] = await Promise.allSettled(tasks)

      if (statsRes.status === 'fulfilled' && !statsRes.value.error) {
        setStats(statsRes.value.data)
      }
      if (loginsRes?.status === 'fulfilled' && !loginsRes.value.error) {
        setLogins(loginsRes.value.data || [])
      }
      if (assignRes?.status === 'fulfilled' && !assignRes.value.error) {
        setAssignments(assignRes.value.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <SkeletonDashboard />

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Welcome banner ────────────────────────────────── */}
      <div className="rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-sm">
        <h2 className="text-xl font-bold">
          Selamat datang, {profile?.full_name?.split(' ')[0] ?? 'Pengguna'} 👋
        </h2>
        <p className="mt-1 text-sm text-blue-100">
          {roleLabel} · {profile?.unit_name ?? 'STIKOM Yos Sudarso'}
          {stats?.active_cycle_name
            ? ` — Siklus ${stats.active_cycle_name} sedang berjalan.`
            : ' — Belum ada siklus aktif.'}
        </p>
      </div>

      {/* ── Stats cards (Super Admin & Kepala LPMPP) ──────── */}
      {isSuperOrLpmpp && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={ClipboardList} label="Total Instrumen"
            value={stats?.total_instruments} color="blue" />
          <StatCard icon={Building2}     label="Total Unit / Prodi"
            value={stats?.total_units}      color="teal" />
          <StatCard icon={Users}         label="Total Pengguna"
            value={stats?.total_users}      color="purple" />
          <StatCard icon={CalendarCheck} label="Siklus Aktif"
            value={stats?.active_cycle_name ? '1' : '0'}
            sub={stats?.active_cycle_name ?? 'Belum ada'} color="green" />
        </div>
      )}

      {/* ── Stats cards (Auditee) ─────────────────────────── */}
      {role === 'auditee' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={ClipboardList} label="Instrumen Ditugaskan"
            value={stats?.total_instruments} color="blue" />
          <StatCard icon={UserCheck}     label="Sudah Dikerjakan"
            value={stats?.verified_submissions} color="green"
            sub={stats?.total_submissions > 0
              ? `${Math.round(stats.verified_submissions / stats.total_instruments * 100)}%`
              : undefined} />
          <StatCard icon={Clock}         label="Menunggu Review"
            value={stats?.pending_review} color="amber" />
          <StatCard icon={Building2}     label="Unit Anda"
            value={profile?.unit_name ?? '—'} color="teal" />
        </div>
      )}

      {/* ── Dua kolom aktivitas (Super Admin) ─────────────── */}
      {isSuperOrLpmpp && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Kartu 1: Login Pengguna Terbaru */}
          <div className="rounded-md border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Login Pengguna Terbaru</h3>
                <p className="text-xs text-gray-500 mt-0.5">Aktivitas masuk ke sistem</p>
              </div>
              <LogIn className="h-4 w-4 text-gray-400" />
            </div>
            <div className="divide-y divide-gray-100">
              {logins.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-400">Belum ada data login</p>
              ) : logins.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar user={u} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {u.full_name || u.email}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                    <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(u.last_sign_in_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kartu 2: Penugasan Instrumen Terbaru */}
          <div className="rounded-md border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Penugasan Instrumen Terbaru</h3>
                <p className="text-xs text-gray-500 mt-0.5">Instrumen yang baru ditugaskan ke unit</p>
              </div>
              <Link2 className="h-4 w-4 text-gray-400" />
            </div>
            <div className="divide-y divide-gray-100">
              {assignments.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-400">
                  Belum ada penugasan instrumen
                </p>
              ) : assignments.map(a => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {a.instrument_name} — {a.unit_name}
                    </p>
                    <p className="text-xs text-gray-400">{a.cycle_name} · {timeAgo(a.created_at)}</p>
                  </div>
                  <span className="ml-3 shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    Ditugaskan
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Aktivitas Auditee / Auditor ───────────────────── */}
      {!isSuperOrLpmpp && (
        <div className="rounded-md border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Aktivitas Terbaru</h3>
          </div>
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            Data aktivitas siklus akan tampil di sini setelah instrumen ditugaskan.
          </div>
        </div>
      )}

    </div>
  )
}
