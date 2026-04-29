/**
 * Auditor — Daftar Penugasan Audit
 * Menampilkan semua unit_instruments yang ditugaskan ke auditor yang login.
 * Hanya submission berstatus 'submitted' ke atas yang bisa diaudit.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardCheck, Loader2, Building2, FileText,
  ArrowRight, CheckCircle2, Clock, AlertCircle, Search,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

/* ─── Status badge ──────────────────────────────────────────── */
const STATUS_MAP = {
  draft:            { label: 'Draft',          color: 'bg-gray-100 text-gray-600' },
  submitted:        { label: 'Menunggu Audit',  color: 'bg-blue-100 text-blue-700' },
  under_review:     { label: 'Sedang Diaudit', color: 'bg-amber-100 text-amber-700' },
  revision_needed:  { label: 'Perlu Revisi',   color: 'bg-red-100 text-red-700' },
  verified:         { label: 'Terverifikasi',  color: 'bg-green-100 text-green-700' },
  closed:           { label: 'Selesai',        color: 'bg-gray-100 text-gray-500' },
}

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.draft
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  )
}

/* ─── Audit readiness icon ──────────────────────────────────── */
function ReadinessIcon({ status }) {
  if (status === 'verified' || status === 'closed') {
    return <CheckCircle2 className="h-4 w-4 text-green-500" />
  }
  if (status === 'submitted' || status === 'under_review') {
    return <Clock className="h-4 w-4 text-amber-500" />
  }
  return <AlertCircle className="h-4 w-4 text-gray-300" />
}

/* ─── Main Component ────────────────────────────────────────── */
export default function AuditorAssignments() {
  const { user, isAuditorFunc } = useAuth()
  const navigate = useNavigate()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [search, setSearch]           = useState('')

  useEffect(() => { if (user) loadAssignments() }, [user])

  async function loadAssignments() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('unit_instrument_auditors')
        .select(`
          id,
          unit_instrument_id,
          unit_instruments (
            id, cycle_id,
            units        ( id, name, code ),
            instruments  ( id, code, name ),
            audit_cycles ( id, name, is_active ),
            submissions  ( id, status, updated_at )
          )
        `)
        .eq('auditor_id', user.id)
        .order('created_at', { ascending: false })

      if (err) throw err

      setAssignments(
        (data || []).map(a => ({
          id:             a.id,
          uiId:           a.unit_instrument_id,
          unit:           a.unit_instruments?.units,
          instrument:     a.unit_instruments?.instruments,
          cycle:          a.unit_instruments?.audit_cycles,
          submission:     a.unit_instruments?.submissions?.[0] || null,
        }))
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function canViewOrAudit(submission) {
    return submission && ['submitted', 'under_review', 'verified', 'closed'].includes(submission.status)
  }

  function getButtonLabel(status) {
    if (status === 'verified' || status === 'closed') return 'Lihat Hasil'
    if (status === 'under_review') return 'Lanjut Audit'
    return 'Mulai Audit'
  }

  const filtered = assignments.filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      a.unit?.name?.toLowerCase().includes(q) ||
      a.instrument?.name?.toLowerCase().includes(q) ||
      a.cycle?.name?.toLowerCase().includes(q)
    )
  })

  // ── Render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-500">Memuat penugasan...</span>
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Penugasan Audit</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Daftar unit yang Anda ditugaskan untuk diaudit — {assignments.length} penugasan
          </p>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari unit / instrumen..."
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Gagal memuat data: {error}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-amber-500" /> Siap diaudit
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Selesai
        </span>
        <span className="flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-gray-300" /> Belum submit
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-white p-10 text-center shadow-sm">
          <ClipboardCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">
            {assignments.length === 0 ? 'Belum ada penugasan audit' : 'Tidak ada hasil pencarian'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {assignments.length === 0
              ? 'Super Admin akan menugaskan unit kepada Anda melalui menu Plotting Auditor.'
              : 'Coba kata kunci lain.'}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span className="w-5"></span>
            <span>Unit / Prodi</span>
            <span>Instrumen</span>
            <span>Status Evaluasi</span>
            <span>Aksi</span>
          </div>

          <div className="divide-y divide-gray-100">
            {filtered.map(a => {
              const status = a.submission?.status ?? 'draft'
              const viewable = canViewOrAudit(a.submission)

              return (
                <div
                  key={a.id}
                  className={`grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-4 items-center px-5 py-4 transition-colors ${
                    viewable ? 'hover:bg-blue-50/40' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Readiness icon */}
                  <ReadinessIcon status={status} />

                  {/* Unit */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <p className="text-sm font-medium text-gray-900 truncate">{a.unit?.name ?? '—'}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{a.unit?.code}</p>
                  </div>

                  {/* Instrument */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <p className="text-sm font-medium text-gray-700 truncate">{a.instrument?.name ?? '—'}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{a.instrument?.code}</p>
                  </div>

                  {/* Status */}
                  <div className="space-y-1">
                    <StatusBadge status={status} />
                    {a.submission?.updated_at && (
                      <p className="text-[11px] text-gray-400">
                        {new Date(a.submission.updated_at).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => navigate(`/auditor/audit/${a.uiId}`)}
                    disabled={!canViewOrAudit(a.submission)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      status === 'verified' || status === 'closed'
                        ? 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                        : canViewOrAudit(a.submission)
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {getButtonLabel(status)}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
