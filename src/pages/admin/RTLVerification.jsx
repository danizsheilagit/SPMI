/**
 * Auditor / Admin — Verifikasi RTL & Penutupan Temuan AMI
 * Dikelompokkan per unit. Auditor:
 *   1. Verifikasi tiap RTL action (done → verified)
 *   2. Setelah semua verified → "Tutup Temuan AMI" (submission → closed)
 */
import { useEffect, useState } from 'react'
import {
  Loader2, AlertCircle, CheckCircle2, Clock, Circle,
  Search, Building2, ChevronDown, ChevronRight,
  XCircle, Shield,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_MAP = {
  open:        { label: 'Belum Mulai',       color: 'bg-gray-100 text-gray-600',       icon: Circle       },
  in_progress: { label: 'Sedang Dikerjakan', color: 'bg-blue-100 text-blue-700',       icon: Clock        },
  done:        { label: 'Selesai',           color: 'bg-green-100 text-green-700',     icon: CheckCircle2 },
  verified:    { label: 'Terverifikasi ✅',  color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
}

const SUB_STATUS_COLOR = {
  verified: 'bg-green-100 text-green-700',
  closed:   'bg-gray-100 text-gray-500',
  default:  'bg-blue-100 text-blue-700',
}

export default function RTLVerification() {
  const { user } = useAuth()
  const [unitGroups,  setUnitGroups]  = useState([]) // [{unit, submission, rtlItems}]
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [search,      setSearch]      = useState('')
  const [expanded,    setExpanded]    = useState({})
  const [verifying,   setVerifying]   = useState(null)
  const [closing,     setClosing]     = useState(null)

  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      // 1. Semua RTL actions dengan info unit dan komponen
      const { data: rtls, error: e1 } = await supabase
        .from('rtl_actions')
        .select(`
          id, description, status, target_date, evidence_url, updated_at,
          unit_id,
          units              ( id, name, code ),
          instrument_components ( id, code, name ),
          rtm_findings       ( keputusan, batas_waktu )
        `)
        .order('updated_at', { ascending: false })
      if (e1) throw e1

      // 2. Semua submission yang verified/closed (untuk tombol tutup)
      const { data: subs } = await supabase
        .from('submissions')
        .select(`
          id, status, updated_at,
          unit_instruments (
            id,
            units       ( id, name ),
            instruments ( id, name ),
            audit_cycles( id, name, is_active )
          )
        `)
        .in('status', ['verified', 'closed'])

      // Map submission by unit_id (ambil yang paling aktif)
      const subByUnit = {}
      for (const s of subs || []) {
        const uid = s.unit_instruments?.units?.id
        if (!uid) continue
        // prefer active cycle
        if (!subByUnit[uid] || s.unit_instruments?.audit_cycles?.is_active) {
          subByUnit[uid] = s
        }
      }

      // 3. Kelompokkan RTL per unit
      const groupMap = {}
      for (const r of rtls || []) {
        const uid = r.unit_id
        if (!uid) continue
        if (!groupMap[uid]) {
          groupMap[uid] = {
            unit:       r.units,
            submission: subByUnit[uid] || null,
            rtlItems:   [],
          }
        }
        groupMap[uid].rtlItems.push(r)
      }

      const groups = Object.values(groupMap)
      // Default: expand units with 'done' items
      const initExp = {}
      groups.forEach(g => {
        if (g.rtlItems.some(i => i.status === 'done')) initExp[g.unit?.id] = true
      })
      setExpanded(initExp)
      setUnitGroups(groups)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(unitId, itemId) {
    setVerifying(itemId)
    setError(null)
    try {
      const { error: e } = await supabase
        .from('rtl_actions')
        .update({
          status:      'verified',
          verifier_id: user.id,
          verified_at: new Date().toISOString(),
          updated_at:  new Date().toISOString(),
        })
        .eq('id', itemId)
      if (e) throw e

      setUnitGroups(prev => prev.map(g => {
        if (g.unit?.id !== unitId) return g
        return { ...g, rtlItems: g.rtlItems.map(i => i.id === itemId ? { ...i, status: 'verified' } : i) }
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setVerifying(null)
    }
  }

  async function handleCloseAMI(unitId, submissionId) {
    if (!confirm('Tutup temuan AMI untuk unit ini? Status submission akan berubah menjadi CLOSED dan tidak dapat dibuka kembali.')) return
    setClosing(unitId)
    setError(null)
    try {
      const { error: e } = await supabase
        .from('submissions')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', submissionId)
      if (e) throw e

      setUnitGroups(prev => prev.map(g => {
        if (g.unit?.id !== unitId) return g
        return { ...g, submission: { ...g.submission, status: 'closed' } }
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setClosing(null)
    }
  }

  const filtered = unitGroups.filter(g =>
    !search ||
    g.unit?.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.unit?.code?.toLowerCase().includes(search.toLowerCase())
  )

  // Stats
  const totalRTL    = unitGroups.reduce((s, g) => s + g.rtlItems.length, 0)
  const doneRTL     = unitGroups.reduce((s, g) => s + g.rtlItems.filter(i => i.status === 'done').length, 0)
  const verifiedRTL = unitGroups.reduce((s, g) => s + g.rtlItems.filter(i => i.status === 'verified').length, 0)
  const closedUnits = unitGroups.filter(g => g.submission?.status === 'closed').length

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
      <span className="text-sm text-gray-500">Memuat data RTL...</span>
    </div>
  )

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Verifikasi RTL & Penutupan Temuan</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Verifikasi RTL per unit lalu tutup temuan AMI jika sudah sah dan efektif
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total RTL',     value: totalRTL,    color: 'text-gray-700' },
          { label: 'Menunggu Review', value: doneRTL,   color: 'text-green-600' },
          { label: 'Terverifikasi', value: verifiedRTL, color: 'text-emerald-600' },
          { label: 'Unit Ditutup',  value: closedUnits, color: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari unit..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Unit groups */}
      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
          Tidak ada data RTL
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(group => {
            const uid        = group.unit?.id
            const allDone    = group.rtlItems.every(i => ['done', 'verified'].includes(i.status))
            const allVerified = group.rtlItems.every(i => i.status === 'verified')
            const isClosed   = group.submission?.status === 'closed'
            const hasDoneItems = group.rtlItems.some(i => i.status === 'done')
            const doneCount  = group.rtlItems.filter(i => ['done', 'verified'].includes(i.status)).length

            return (
              <div key={uid}
                className={`rounded-md border bg-white shadow-sm overflow-hidden ${
                  isClosed ? 'border-gray-200 opacity-70' :
                  allVerified ? 'border-emerald-300' :
                  hasDoneItems ? 'border-green-300' : 'border-gray-200'
                }`}>

                {/* Unit header */}
                <div className={`flex items-center gap-3 px-4 py-3 border-b ${
                  isClosed ? 'bg-gray-50 border-gray-100' :
                  allVerified ? 'bg-emerald-50 border-emerald-100' :
                  hasDoneItems ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'
                }`}>
                  <button
                    onClick={() => setExpanded(e => ({ ...e, [uid]: !e[uid] }))}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{group.unit?.name}</p>
                      <p className="text-xs text-gray-400">
                        {group.unit?.code} · {doneCount}/{group.rtlItems.length} RTL selesai
                      </p>
                    </div>
                    {expanded[uid]
                      ? <ChevronDown className="h-4 w-4 text-gray-400" />
                      : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  </button>

                  {/* Status + Close button */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isClosed ? (
                      <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-500">
                        <XCircle className="h-3 w-3" /> Temuan Ditutup
                      </span>
                    ) : allVerified && group.submission ? (
                      <button
                        onClick={() => handleCloseAMI(uid, group.submission.id)}
                        disabled={closing === uid}
                        className="inline-flex items-center gap-1.5 rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-50"
                      >
                        {closing === uid
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Shield className="h-3 w-3" />}
                        Tutup Temuan AMI
                      </button>
                    ) : allVerified ? (
                      <span className="text-xs text-emerald-600 font-medium">✅ Semua RTL Verified</span>
                    ) : hasDoneItems ? (
                      <span className="text-xs text-green-600 font-medium">● Ada RTL siap diverifikasi</span>
                    ) : null}
                  </div>
                </div>

                {/* RTL items */}
                {expanded[uid] && (
                  <div className="divide-y divide-gray-50">
                    {group.rtlItems.map(item => {
                      const s    = STATUS_MAP[item.status] || STATUS_MAP.open
                      const Icon = s.icon
                      return (
                        <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                          <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${
                            item.status === 'verified' ? 'text-emerald-500' :
                            item.status === 'done'     ? 'text-green-500' :
                            item.status === 'in_progress' ? 'text-blue-500' : 'text-gray-300'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">{item.description}</p>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              {item.instrument_components && (
                                <span className="text-[11px] font-bold text-blue-700 bg-blue-100 rounded px-1.5">
                                  {item.instrument_components.code}
                                </span>
                              )}
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.color}`}>
                                {s.label}
                              </span>
                              {item.target_date && (
                                <span className="text-[11px] text-gray-400">
                                  Target: {new Date(item.target_date).toLocaleDateString('id-ID')}
                                </span>
                              )}
                              {item.rtm_findings?.batas_waktu && (
                                <span className="text-[11px] text-amber-600">
                                  Batas RTM: {new Date(item.rtm_findings.batas_waktu).toLocaleDateString('id-ID')}
                                </span>
                              )}
                            </div>
                            {item.rtm_findings?.keputusan && (
                              <p className="text-[11px] text-gray-500 mt-1 italic line-clamp-1">
                                RTM: {item.rtm_findings.keputusan}
                              </p>
                            )}
                          </div>

                          {/* Aksi verifikasi */}
                          {item.status === 'done' && !isClosed ? (
                            <button
                              onClick={() => handleVerify(uid, item.id)}
                              disabled={verifying === item.id}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50 shrink-0"
                            >
                              {verifying === item.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <CheckCircle2 className="h-3 w-3" />}
                              Verifikasi
                            </button>
                          ) : item.status === 'verified' ? (
                            <span className="text-xs text-emerald-600 shrink-0">✅</span>
                          ) : (
                            <span className="text-xs text-gray-300 shrink-0">—</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
