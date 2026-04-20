/**
 * Admin — Manajemen Pengguna
 * Role utama: super_admin, kepala_lpmpp, pimpinan, auditee
 * Fungsi tambahan: is_auditor (bisa diaktifkan untuk siapa saja)
 */
import { useEffect, useState } from 'react'
import {
  Users, Loader2, AlertCircle, Pencil, X, Check,
  ShieldCheck, UserCog, Eye, Building2, Award, Mic2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SkeletonTable } from '../../components/UI/Skeleton'

/* ─── Konstanta role UTAMA (bukan auditor) ─────────────────── */
const ROLE_LABELS = {
  super_admin:  'Super Admin',
  kepala_lpmpp: 'Kepala LPMPP',
  pimpinan:     'Pimpinan',
  auditee:      'Auditee',
}
const ROLE_COLORS = {
  super_admin:  'bg-purple-100 text-purple-700',
  kepala_lpmpp: 'bg-teal-100   text-teal-700',
  pimpinan:     'bg-amber-100  text-amber-700',
  auditee:      'bg-blue-100   text-blue-700',
}
const ROLE_ICONS = {
  super_admin:  ShieldCheck,
  kepala_lpmpp: Award,
  pimpinan:     Users,
  auditee:      UserCog,
}

export default function UserManagement() {
  const [users, setUsers]     = useState([])
  const [units, setUnits]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // Edit modal
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm]     = useState({
    role: '', unit_id: '', full_name: '', is_auditor: false,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, unitsRes] = await Promise.allSettled([
        supabase.rpc('get_all_profiles'),
        supabase.from('units').select('id, name, code, type').eq('is_active', true).order('name'),
      ])
      if (usersRes.status === 'fulfilled') {
        if (usersRes.value.error) throw usersRes.value.error
        setUsers(usersRes.value.data || [])
      } else {
        throw usersRes.reason
      }
      if (unitsRes.status === 'fulfilled') setUnits(unitsRes.value.data || [])
    } catch (err) {
      setError(err.message || 'Gagal memuat data pengguna.')
    } finally {
      setLoading(false)
    }
  }

  function openEdit(user) {
    setEditTarget(user)
    setEditForm({
      role:       user.role      || 'auditee',
      unit_id:    user.unit_id   || '',
      full_name:  user.full_name || '',
      is_auditor: user.is_auditor ?? false,
    })
  }

  async function handleSave() {
    if (!editTarget) return
    setSaving(true)
    try {
      // 1. Update role + unit melalui RPC
      const { error: rpcErr } = await supabase.rpc('update_user_profile', {
        p_user_id:   editTarget.id,
        p_role:      editForm.role,
        p_unit_id:   editForm.unit_id || null,
        p_full_name: editForm.full_name || null,
      })
      if (rpcErr) throw rpcErr

      // 2. Update is_auditor langsung di tabel profiles
      const { error: flagErr } = await supabase
        .from('profiles')
        .update({ is_auditor: editForm.is_auditor })
        .eq('id', editTarget.id)
      if (flagErr) throw flagErr

      setEditTarget(null)
      await loadData()
    } catch (err) {
      alert('Gagal menyimpan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Stats ──────────────────────────────────────────────────────
  const roleCounts = Object.keys(ROLE_LABELS).map(role => ({
    role,
    label: ROLE_LABELS[role],
    count: users.filter(u => u.role === role).length,
    color: ROLE_COLORS[role],
  }))
  const auditorCount = users.filter(u => u.is_auditor).length

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Manajemen Pengguna</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Kelola role jabatan dan fungsi auditor untuk setiap pengguna
        </p>
      </div>

      {/* ── Info banner ───────────────────────────────────────── */}
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <strong>Fungsi Auditor</strong> adalah fungsi tambahan — siapa saja bisa diaktifkan
          sebagai auditor terlepas dari role jabatannya. Aktifkan di modal Edit tiap pengguna.
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {roleCounts.map(s => (
          <div key={s.role} className="rounded-md border border-gray-200 bg-white p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-gray-900">{s.count}</p>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
              {s.label}
            </span>
          </div>
        ))}
        {/* Auditor function count */}
        <div className="rounded-md border border-green-200 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-green-600">{auditorCount}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
            <Mic2 className="h-3 w-3" /> Auditor
          </span>
        </div>
      </div>

      {/* ── User Table ────────────────────────────────────────── */}
      {loading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Gagal memuat data</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-10 text-center">
          <Users className="h-8 w-8 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">Belum ada pengguna. User akan muncul setelah login pertama kali via SSO.</p>
        </div>
      ) : (
        <div className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Pengguna</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Unit</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Bergabung</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  {/* Avatar + name */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                          {user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{user.full_name || '(nama belum diset)'}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role + auditor badge */}
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                      {user.is_auditor && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-green-100 text-green-700 border border-green-200">
                          <Mic2 className="h-2.5 w-2.5" /> Auditor
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Unit */}
                  <td className="px-5 py-3">
                    {user.unit_name ? (
                      <span className="flex items-center gap-1 text-gray-700">
                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-xs">{user.unit_name}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  {/* Joined */}
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>

                  {/* Edit button */}
                  <td className="px-3 py-3">
                    <button
                      onClick={() => openEdit(user)}
                      className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit Modal ────────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Edit Pengguna</h2>
                <p className="text-xs text-gray-500 truncate max-w-xs">{editTarget.email}</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">

              {/* Nama */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nama Lengkap</label>
                <input
                  value={editForm.full_name}
                  onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Nama lengkap"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Role Jabatan */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Role / Jabatan Utama
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ROLE_LABELS).map(([value, label]) => {
                    const Icon = ROLE_ICONS[value]
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setEditForm(f => ({
                          ...f,
                          role: value,
                          unit_id: value !== 'auditee' ? '' : f.unit_id,
                        }))}
                        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                          editForm.role === value
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                        }`}
                      >
                        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                        {label}
                        {editForm.role === value && <Check className="h-3.5 w-3.5 ml-auto" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Unit — hanya auditee */}
              {editForm.role === 'auditee' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit / Prodi *</label>
                  <select
                    value={editForm.unit_id}
                    onChange={e => setEditForm(f => ({ ...f, unit_id: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Pilih Unit —</option>
                    {units.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                    ))}
                  </select>
                  {!editForm.unit_id && (
                    <p className="mt-1 text-xs text-amber-600">⚠ Auditee harus memiliki unit yang ditugaskan.</p>
                  )}
                </div>
              )}

              {/* ── Fungsi Auditor ─────────────────────────────── */}
              <div className={`rounded-lg border-2 px-4 py-3 transition-colors ${
                editForm.is_auditor ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  {/* Toggle switch */}
                  <div
                    onClick={() => setEditForm(f => ({ ...f, is_auditor: !f.is_auditor }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      editForm.is_auditor ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      editForm.is_auditor ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${editForm.is_auditor ? 'text-green-700' : 'text-gray-600'}`}>
                      <Mic2 className="inline h-3.5 w-3.5 mr-1" />
                      Fungsi Auditor
                      {editForm.is_auditor && <span className="ml-2 text-xs font-normal">✓ Aktif</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Pengguna ini dapat ditugaskan sebagai auditor saat plotting
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setEditTarget(null)}
                className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (editForm.role === 'auditee' && !editForm.unit_id)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
