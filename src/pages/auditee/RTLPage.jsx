/**
 * Auditee — Rencana Tindak Lanjut (RTL)
 * Menampilkan keputusan RTM per komponen dan form RTL auditee.
 * Hanya muncul setelah RTM is_published = true.
 */
import { useEffect, useState } from 'react'
import {
  Loader2, AlertCircle, CheckCircle2, Clock, Circle,
  Plus, Save, Trash2, Upload, ExternalLink, ChevronDown, ChevronRight,
  ClipboardList, Calendar,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_MAP = {
  open:        { label: 'Belum Mulai', color: 'bg-gray-100 text-gray-600',   icon: Circle },
  in_progress: { label: 'Sedang Dikerjakan', color: 'bg-blue-100 text-blue-700',  icon: Clock },
  done:        { label: 'Selesai',     color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  verified:    { label: 'Terverifikasi ✅', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
}

const CATEGORY_COLOR = {
  KTS_M:  'bg-red-100 text-red-700',
  KTS_m:  'bg-amber-100 text-amber-700',
  OB:     'bg-blue-100 text-blue-700',
  SPT:    'bg-violet-100 text-violet-700',
}
const CATEGORY_LABEL = { KTS_M: 'KTS Mayor', KTS_m: 'KTS Minor', OB: 'OB', SPT: 'SPT' }

/* ── RTL Item (per tindakan) ─────────────────────────────────── */
function RTLItem({ item, onUpdate, onDelete, disabled }) {
  const s = STATUS_MAP[item.status] || STATUS_MAP.open
  const Icon = s.icon

  async function updateStatus(newStatus) {
    onUpdate({ ...item, status: newStatus })
  }

  return (
    <div className={`rounded-md border px-4 py-3 space-y-2 ${
      item.status === 'verified' ? 'border-emerald-200 bg-emerald-50' :
      item.status === 'done'     ? 'border-green-200 bg-green-50'   :
      item.status === 'in_progress' ? 'border-blue-200 bg-blue-50' :
      'border-gray-200 bg-white'
    }`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
          item.status === 'done' || item.status === 'verified' ? 'text-green-500' :
          item.status === 'in_progress' ? 'text-blue-500' : 'text-gray-400'
        }`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 leading-relaxed">{item.description}</p>
          {item.target_date && (
            <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
              <Calendar className="h-3 w-3" />
              Target: {new Date(item.target_date).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          )}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 ${s.color}`}>
          {s.label}
        </span>
      </div>

      {item.evidence_url && (
        <a href={item.evidence_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
          <Upload className="h-3 w-3" /> Lihat Bukti <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}

      {!disabled && item.status !== 'verified' && (
        <div className="flex items-center gap-2 pt-1">
          {item.status !== 'in_progress' && item.status !== 'done' && (
            <button onClick={() => updateStatus('in_progress')}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-800">
              → Mulai Kerjakan
            </button>
          )}
          {item.status === 'in_progress' && (
            <button onClick={() => updateStatus('done')}
              className="text-[11px] font-medium text-green-600 hover:text-green-800">
              ✓ Tandai Selesai
            </button>
          )}
          {item.status === 'done' && (
            <button onClick={() => updateStatus('in_progress')}
              className="text-[11px] text-gray-400 hover:text-gray-600">
              ← Buka kembali
            </button>
          )}
          <button onClick={() => onDelete(item.id)}
            className="ml-auto text-[11px] text-red-400 hover:text-red-600">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Add RTL Form ────────────────────────────────────────────── */
function AddRTLForm({ rtmFindingId, unitId, findingId, componentId, onAdded }) {
  const { user } = useAuth()
  const [open, setOpen]    = useState(false)
  const [desc, setDesc]    = useState('')
  const [date, setDate]    = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!desc.trim()) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('rtl_actions')
        .insert({
          finding_id:    findingId,
          unit_id:       unitId,
          component_id:  componentId,
          rtm_finding_id: rtmFindingId,
          assigned_to:   user.id,
          description:   desc,
          target_date:   date || null,
          status:        'open',
        })
        .select().single()
      if (error) throw error
      onAdded(data)
      setDesc('')
      setDate('')
      setOpen(false)
    } catch (err) {
      alert('Gagal menyimpan RTL: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium mt-1">
      <Plus className="h-3.5 w-3.5" /> Tambah RTL
    </button>
  )

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-2 mt-2">
      <textarea
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="Rencana tindakan yang akan dilakukan..."
        rows={2}
        className="w-full rounded border border-blue-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none bg-white"
      />
      <div className="flex items-center gap-2">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="rounded border border-blue-200 px-2 py-1 text-xs bg-white" />
        <button onClick={submit} disabled={saving || !desc.trim()}
          className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Simpan
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Batal</button>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function RTLPage() {
  const { user } = useAuth()
  const [groups,   setGroups]   = useState([]) // [{rtmFinding, rtlActions}]
  const [expanded, setExpanded] = useState({})
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      // 1. Get unit & active cycle info dari user
      const { data: profile } = await supabase
        .rpc('get_my_profile')
      if (!profile?.unit_id) throw new Error('Unit tidak ditemukan di profil Anda')

      const unitId = profile.unit_id

      // 2. Load rtm_findings untuk unit ini (dari RTM yang sudah published)
      const { data: rtmFindings, error: e1 } = await supabase
        .from('rtm_findings')
        .select(`
          id, keputusan, batas_waktu, component_id, unit_id,
          instrument_id,
          rtm_sessions ( id, title, is_published, held_at, audit_cycles(id, name) ),
          instrument_components ( id, code, name )
        `)
        .eq('unit_id', unitId)
        .eq('rtm_sessions.is_published', true)
        .order('created_at')
      if (e1) throw e1

      if (!rtmFindings?.length) {
        setGroups([])
        setLoading(false)
        return
      }

      // 3. Load rtl_actions untuk unit ini
      const rtmFindingIds = rtmFindings.map(rf => rf.id)
      const { data: rtlActions, error: e2 } = await supabase
        .from('rtl_actions')
        .select('*')
        .eq('unit_id', unitId)
        .in('rtm_finding_id', rtmFindingIds)
      if (e2) throw e2

      const actionsByFinding = {}
      for (const a of rtlActions || []) {
        if (!actionsByFinding[a.rtm_finding_id]) actionsByFinding[a.rtm_finding_id] = []
        actionsByFinding[a.rtm_finding_id].push(a)
      }

      // 4. Load audit_finding untuk mendapatkan finding_id
      const { data: findings } = await supabase
        .from('audit_findings')
        .select('id, rubric_results, submissions(unit_instrument_id, unit_instruments(unit_id))')
        .eq('submissions.unit_instruments.unit_id', unitId)

      const findingByComp = {}
      for (const f of findings || []) {
        const rubric = f.rubric_results || {}
        for (const compId of Object.keys(rubric)) {
          findingByComp[compId] = f.id
        }
      }

      const grouped = rtmFindings.map(rf => ({
        rtmFinding: rf,
        findingId:  findingByComp[rf.component_id] || null,
        rtlActions: actionsByFinding[rf.id] || [],
      }))

      // Init expanded
      const initExpanded = {}
      grouped.forEach((_, i) => { initExpanded[i] = true })
      setExpanded(initExpanded)
      setGroups(grouped)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateRTL(groupIdx, updated) {
    try {
      const { error } = await supabase
        .from('rtl_actions')
        .update({ status: updated.status, updated_at: new Date().toISOString() })
        .eq('id', updated.id)
      if (error) throw error
      setGroups(prev => prev.map((g, i) => i !== groupIdx ? g : {
        ...g,
        rtlActions: g.rtlActions.map(a => a.id === updated.id ? updated : a),
      }))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteRTL(groupIdx, actionId) {
    if (!confirm('Hapus RTL ini?')) return
    try {
      const { error } = await supabase.from('rtl_actions').delete().eq('id', actionId)
      if (error) throw error
      setGroups(prev => prev.map((g, i) => i !== groupIdx ? g : {
        ...g, rtlActions: g.rtlActions.filter(a => a.id !== actionId),
      }))
    } catch (err) {
      setError(err.message)
    }
  }

  function handleAddRTL(groupIdx, newAction) {
    setGroups(prev => prev.map((g, i) => i !== groupIdx ? g : {
      ...g, rtlActions: [...g.rtlActions, newAction],
    }))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
      <span className="text-sm text-gray-500">Memuat RTL...</span>
    </div>
  )

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Rencana Tindak Lanjut</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Buat RTL berdasarkan keputusan Rapat Tinjau Manajemen
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-10 text-center">
          <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Belum ada keputusan RTM untuk unit Anda</p>
          <p className="text-xs text-gray-400 mt-1">
            RTL akan muncul setelah Pimpinan mempublish hasil Rapat Tinjau Manajemen.
          </p>
        </div>
      ) : (
        <>
          {/* RTM info banner */}
          {groups[0]?.rtmFinding?.rtm_sessions && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-xs font-semibold text-blue-700">
                📋 Berdasarkan RTM: {groups[0].rtmFinding.rtm_sessions.title}
              </p>
              {groups[0].rtmFinding.rtm_sessions.held_at && (
                <p className="text-[11px] text-blue-500 mt-0.5">
                  Tanggal rapat: {new Date(groups[0].rtmFinding.rtm_sessions.held_at).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
              )}
            </div>
          )}

          {/* Findings + RTL */}
          <div className="space-y-4">
            {groups.map((group, idx) => {
              const rf   = group.rtmFinding
              const comp = rf.instrument_components
              const done = group.rtlActions.filter(a => ['done', 'verified'].includes(a.status)).length
              const total = group.rtlActions.length

              return (
                <div key={rf.id} className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
                  {/* Component header */}
                  <button
                    onClick={() => setExpanded(e => ({ ...e, [idx]: !e[idx] }))}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 text-left"
                  >
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-100 rounded px-1.5 py-0.5 shrink-0">
                      {comp?.code}
                    </span>
                    <p className="flex-1 text-sm font-semibold text-gray-900 truncate">{comp?.name}</p>
                    {total > 0 && (
                      <span className={`text-[11px] font-medium shrink-0 ${done === total ? 'text-green-600' : 'text-gray-400'}`}>
                        {done}/{total} selesai
                      </span>
                    )}
                    {expanded[idx]
                      ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                  </button>

                  {expanded[idx] && (
                    <div className="px-4 py-3 space-y-3">
                      {/* Keputusan RTM */}
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-[11px] font-semibold text-amber-700 mb-0.5">
                          🏛️ Keputusan RTM
                        </p>
                        <p className="text-xs text-gray-800">{rf.keputusan}</p>
                        {rf.batas_waktu && (
                          <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Batas waktu: {new Date(rf.batas_waktu).toLocaleDateString('id-ID', {
                              day: 'numeric', month: 'long', year: 'numeric',
                            })}
                          </p>
                        )}
                      </div>

                      {/* RTL list */}
                      {group.rtlActions.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Belum ada RTL. Tambahkan rencana tindakan di bawah.</p>
                      ) : (
                        <div className="space-y-2">
                          {group.rtlActions.map(action => (
                            <RTLItem
                              key={action.id}
                              item={action}
                              onUpdate={updated => handleUpdateRTL(idx, updated)}
                              onDelete={actionId => handleDeleteRTL(idx, actionId)}
                              disabled={action.status === 'verified'}
                            />
                          ))}
                        </div>
                      )}

                      {/* Add RTL */}
                      <AddRTLForm
                        rtmFindingId={rf.id}
                        unitId={rf.unit_id}
                        findingId={group.findingId}
                        componentId={rf.component_id}
                        onAdded={newAction => handleAddRTL(idx, newAction)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
