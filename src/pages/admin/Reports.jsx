/**
 * Laporan & Rekap — Admin / Kepala LPMPP / Pimpinan
 * 4 sections:
 *   1. Ringkasan Siklus (stat cards)
 *   2. Rekap Per Unit (tabel)
 *   3. Statistik Temuan (bar chart CSS)
 *   4. Progress RTL (bar chart CSS)
 *
 * PDF Export:
 *   - Per siklus (semua unit) → window.print()
 *   - Per unit → filter + window.print()
 */
import { useEffect, useState, useRef } from 'react'
import {
  Loader2, AlertCircle, Printer, Building2, ChevronDown,
  BarChart3, ClipboardList, CheckCircle2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

/* ── Helpers ─────────────────────────────────────────────────── */
function avg(arr) {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function computeSelfEvalScore(answers = {}, components = []) {
  if (!components.length) return null
  let total = 0
  for (const c of components) {
    const p = answers[c.id] || {}
    const stages = ['penetapan', 'pelaksanaan', 'evaluasi', 'pengendalian', 'peningkatan']
    let score = 0
    for (const s of stages) {
      if (p[s]?.terpenuhi) score++
    }
    total += score
  }
  return (total / (components.length * 5)) * 5
}

function computeDeskScore(rubricResults = {}, components = []) {
  if (!components.length) return null
  let total = 0
  let count = 0
  for (const c of components) {
    const r = rubricResults[c.id]
    if (r?.desk_score != null) {
      total += r.desk_score
      count++
    }
  }
  return count ? total / count : null
}

function countCategories(rubricResults = {}) {
  const counts = { KTS_M: 0, KTS_m: 0, OB: 0, SPT: 0, sesuai: 0 }
  for (const v of Object.values(rubricResults)) {
    if (v.category && counts[v.category] !== undefined) counts[v.category]++
  }
  return counts
}

/* ── Stat Card ───────────────────────────────────────────────── */
function StatCard({ label, value, sub, color = 'text-gray-900' }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
      <p className="text-xs font-medium text-gray-700 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

/* ── Bar Chart (CSS) ─────────────────────────────────────────── */
function BarChart({ data, max }) {
  return (
    <div className="space-y-2">
      {data.map(({ label, value, color }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-24 shrink-0 text-right">{label}</span>
          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
            <div
              className={`h-full rounded transition-all ${color}`}
              style={{ width: max > 0 ? `${(value / max) * 100}%` : '0%', minWidth: value > 0 ? '8px' : 0 }}
            />
          </div>
          <span className="text-xs font-bold text-gray-700 w-6 text-right">{value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Main ────────────────────────────────────────────────────── */
export default function Reports() {
  const { user, role } = useAuth()
  const [cycles,     setCycles]     = useState([])
  const [cycleId,    setCycleId]    = useState('')
  const [unitFilter, setUnitFilter] = useState('all')
  const [unitRows,   setUnitRows]   = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const printRef = useRef(null)

  useEffect(() => { loadCycles() }, [])
  useEffect(() => { if (cycleId) loadReport() }, [cycleId])

  async function loadCycles() {
    const { data } = await supabase
      .from('audit_cycles')
      .select('id, name, academic_year, is_active')
      .order('created_at', { ascending: false })
    const list = data || []
    setCycles(list)
    const active = list.find(c => c.is_active)
    if (active) setCycleId(active.id)
    else if (list[0]) setCycleId(list[0].id)
  }

  async function loadReport() {
    setLoading(true)
    setError(null)
    try {
      // 1. Unit instruments dalam siklus ini
      const { data: uis, error: e1 } = await supabase
        .from('unit_instruments')
        .select(`
          id,
          units       ( id, name, code, assigned_pimpinan_id ),
          instruments ( id, code, name ),
          submissions ( id, status, answers, updated_at ),
          audit_findings_via_submissions:audit_findings (
            id, rubric_results, category
          )
        `)
        .eq('cycle_id', cycleId)
      if (e1) throw e1

      // 2. Components per instrument
      const instrIds = [...new Set((uis || []).map(u => u.instruments?.id).filter(Boolean))]
      let compsMap = {}
      if (instrIds.length) {
        const { data: comps } = await supabase
          .from('instrument_components')
          .select('id, instrument_id')
          .in('instrument_id', instrIds)
        for (const c of comps || []) {
          if (!compsMap[c.instrument_id]) compsMap[c.instrument_id] = []
          compsMap[c.instrument_id].push(c)
        }
      }

      // 3. RTL actions count per unit
      const unitIds = [...new Set((uis || []).map(u => u.units?.id).filter(Boolean))]
      let rtlMap = {}
      if (unitIds.length) {
        const { data: rtls } = await supabase
          .from('rtl_actions')
          .select('unit_id, status')
          .in('unit_id', unitIds)
        for (const r of rtls || []) {
          if (!rtlMap[r.unit_id]) rtlMap[r.unit_id] = { total: 0, done: 0 }
          rtlMap[r.unit_id].total++
          if (['done', 'verified'].includes(r.status)) rtlMap[r.unit_id].done++
        }
      }

      // 4. Build rows
      const rows = (uis || []).map(ui => {
        const sub       = ui.submissions?.[0] || null
        const finding   = ui.audit_findings_via_submissions?.[0] || null
        const comps     = compsMap[ui.instruments?.id] || []
        const selfScore = sub?.answers ? computeSelfEvalScore(sub.answers, comps) : null
        const deskScore = finding?.rubric_results ? computeDeskScore(finding.rubric_results, comps) : null
        const cats      = finding?.rubric_results ? countCategories(finding.rubric_results) : null
        const rtl       = rtlMap[ui.units?.id] || null

        return {
          unitId:     ui.units?.id,
          unitName:   ui.units?.name ?? '—',
          unitCode:   ui.units?.code ?? '',
          instrName:  ui.instruments?.name ?? '—',
          status:     sub?.status ?? 'draft',
          selfScore,
          deskScore,
          cats,
          rtlTotal:   rtl?.total ?? 0,
          rtlDone:    rtl?.done ?? 0,
          pimpinanId: ui.units?.assigned_pimpinan_id,
        }
      })

      // Filter scope pimpinan
      const filtered = role === 'pimpinan'
        ? rows.filter(r => r.pimpinanId === user.id)
        : rows

      setUnitRows(filtered)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handlePrint(unitId = null) {
    if (unitId) setUnitFilter(unitId)
    else setUnitFilter('all')
    setTimeout(() => window.print(), 300)
  }

  // Derived stats
  const displayRows = unitFilter === 'all'
    ? unitRows
    : unitRows.filter(r => r.unitId === unitFilter)

  const totalUnits  = displayRows.length
  const submitted   = displayRows.filter(r => ['submitted','under_review','verified','closed'].includes(r.status)).length
  const verified    = displayRows.filter(r => r.status === 'verified').length
  const catTotals   = { KTS_M: 0, KTS_m: 0, OB: 0, SPT: 0 }
  for (const r of displayRows) {
    if (r.cats) {
      catTotals.KTS_M += r.cats.KTS_M || 0
      catTotals.KTS_m += r.cats.KTS_m || 0
      catTotals.OB    += r.cats.OB    || 0
      catTotals.SPT   += r.cats.SPT   || 0
    }
  }
  const rtlTotal = displayRows.reduce((s, r) => s + r.rtlTotal, 0)
  const rtlDone  = displayRows.reduce((s, r) => s + r.rtlDone, 0)
  const maxCat   = Math.max(...Object.values(catTotals), 1)

  const STATUS_LABEL = {
    draft: 'Draft', submitted: 'Submitted', under_review: 'Diaudit',
    revision_needed: 'Revisi', verified: 'Terverifikasi', closed: 'Selesai',
  }
  const STATUS_COLOR = {
    draft: 'bg-gray-100 text-gray-600', submitted: 'bg-blue-100 text-blue-700',
    under_review: 'bg-amber-100 text-amber-700', revision_needed: 'bg-red-100 text-red-700',
    verified: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-500',
  }

  return (
    <>
      {/* ── Print styles (injected inline) ───────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-report, #print-report * { visibility: visible; }
          #print-report { position: absolute; top: 0; left: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
          @page { margin: 15mm; }
        }
      `}</style>

      <div className="max-w-6xl space-y-6">
        {/* ── Header + controls ── */}
        <div className="flex items-start justify-between gap-4 no-print">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Laporan & Rekap</h1>
            <p className="text-sm text-gray-500 mt-0.5">Rekap hasil AMI per siklus</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Pilih siklus */}
            <select value={cycleId} onChange={e => setCycleId(e.target.value)}
              className="text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Export PDF semua unit */}
            <button onClick={() => handlePrint()}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Printer className="h-4 w-4" /> Export PDF Semua Unit
            </button>

            {/* Export PDF per unit */}
            <div className="relative">
              <select
                onChange={e => e.target.value && handlePrint(e.target.value)}
                className="text-sm border border-gray-200 rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                defaultValue="">
                <option value="" disabled>📄 Export PDF per Unit</option>
                {unitRows.map(r => <option key={r.unitId} value={r.unitId}>{r.unitName}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
            <span className="text-sm text-gray-500">Memuat laporan...</span>
          </div>
        ) : (
          /* ── Print target ── */
          <div id="print-report" ref={printRef}>

            {/* Print header */}
            <div className="hidden print-show mb-6">
              <h1 className="text-lg font-bold">Laporan Audit Mutu Internal</h1>
              <p className="text-sm text-gray-600">{cycles.find(c => c.id === cycleId)?.name}</p>
              {unitFilter !== 'all' && (
                <p className="text-sm text-gray-600">Unit: {unitRows.find(r => r.unitId === unitFilter)?.unitName}</p>
              )}
            </div>

            {/* Section 1: Stats */}
            <section className="space-y-3 mb-6">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" /> Ringkasan Siklus
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total Unit" value={totalUnits} />
                <StatCard label="Sudah Submit" value={submitted}
                  sub={totalUnits ? `${Math.round((submitted/totalUnits)*100)}%` : ''}
                  color="text-blue-600" />
                <StatCard label="Terverifikasi" value={verified}
                  sub={totalUnits ? `${Math.round((verified/totalUnits)*100)}%` : ''}
                  color="text-green-600" />
                <StatCard label="KTS Mayor" value={catTotals.KTS_M}
                  color={catTotals.KTS_M > 0 ? 'text-red-600' : 'text-gray-900'} />
              </div>
            </section>

            {/* Section 2: Per Unit Table */}
            <section className="mb-6">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2 mb-3">
                <Building2 className="h-4 w-4 text-blue-500" /> Rekap Per Unit
              </h2>
              <div className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="grid grid-cols-[1.5fr_1fr_auto_auto_auto_auto] gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  <span>Unit</span>
                  <span>Instrumen</span>
                  <span>Skor ED</span>
                  <span>Skor Desk</span>
                  <span>Temuan</span>
                  <span>RTL</span>
                </div>
                {displayRows.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-400">Tidak ada data</div>
                ) : displayRows.map((r, i) => (
                  <div key={i}
                    className="grid grid-cols-[1.5fr_1fr_auto_auto_auto_auto] gap-3 items-center px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-gray-900">{r.unitName}</p>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLOR[r.status]}`}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400">{r.unitCode}</p>
                    </div>
                    <p className="text-xs text-gray-600 truncate">{r.instrName}</p>
                    <span className={`text-xs font-bold tabular-nums ${r.selfScore != null ? 'text-blue-700' : 'text-gray-300'}`}>
                      {r.selfScore != null ? r.selfScore.toFixed(1) : '—'}/5
                    </span>
                    <span className={`text-xs font-bold tabular-nums ${r.deskScore != null ? 'text-emerald-700' : 'text-gray-300'}`}>
                      {r.deskScore != null ? r.deskScore.toFixed(1) : '—'}/5
                    </span>
                    <div className="text-[11px] space-x-1">
                      {r.cats ? (
                        <>
                          {r.cats.KTS_M > 0 && <span className="text-red-600 font-medium">KTS_M:{r.cats.KTS_M}</span>}
                          {r.cats.KTS_m > 0 && <span className="text-amber-600 font-medium">KTS_m:{r.cats.KTS_m}</span>}
                          {r.cats.OB > 0    && <span className="text-blue-600">OB:{r.cats.OB}</span>}
                          {r.cats.SPT > 0   && <span className="text-violet-600">SPT:{r.cats.SPT}</span>}
                          {Object.values(r.cats).every(v => !v) && <span className="text-gray-300">—</span>}
                        </>
                      ) : <span className="text-gray-300">—</span>}
                    </div>
                    <span className={`text-xs font-medium ${r.rtlTotal > 0 && r.rtlDone === r.rtlTotal ? 'text-green-600' : 'text-gray-500'}`}>
                      {r.rtlTotal > 0 ? `${r.rtlDone}/${r.rtlTotal}${r.rtlDone === r.rtlTotal ? ' ✅' : ''}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 3 + 4: Charts (hanya jika semua unit / data ada) */}
            {unitFilter === 'all' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Section 3: Temuan */}
                <section>
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2 mb-3">
                    <ClipboardList className="h-4 w-4 text-blue-500" /> Statistik Temuan
                  </h2>
                  <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                    <BarChart data={[
                      { label: 'KTS Mayor', value: catTotals.KTS_M, color: 'bg-red-500'    },
                      { label: 'KTS Minor', value: catTotals.KTS_m, color: 'bg-amber-400'  },
                      { label: 'Observasi', value: catTotals.OB,    color: 'bg-blue-500'   },
                      { label: 'SPT',       value: catTotals.SPT,   color: 'bg-violet-500' },
                    ]} max={maxCat} />
                  </div>
                </section>

                {/* Section 4: RTL Progress */}
                <section>
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" /> Progress RTL
                  </h2>
                  <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-900">{rtlDone}</span>
                      <span className="text-sm text-gray-400">/ {rtlTotal} selesai</span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: rtlTotal > 0 ? `${(rtlDone / rtlTotal) * 100}%` : '0%' }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {rtlTotal > 0 ? `${Math.round((rtlDone / rtlTotal) * 100)}% RTL telah selesai` : 'Belum ada data RTL'}
                    </p>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
