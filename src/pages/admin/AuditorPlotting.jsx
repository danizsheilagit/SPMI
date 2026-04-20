/**
 * Admin — Plotting Auditor
 * Tugaskan auditor ke setiap unit_instrument dalam siklus audit.
 * Super Admin only.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Users, Save, AlertCircle, Loader2, CheckCircle2,
  Building2, ClipboardList,
} from 'lucide-react'
import { SkeletonTable } from '../../components/UI/Skeleton'

export default function AuditorPlotting() {
  const [cycles,          setCycles]          = useState([])
  const [selectedCycle,   setSelectedCycle]   = useState(null)
  const [unitInstruments, setUnitInstruments] = useState([])
  const [auditors,        setAuditors]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [saving,          setSaving]          = useState(false)
  const [changes,         setChanges]         = useState({}) // { ui_id: auditor_id }
  const [saved,           setSaved]           = useState(false)
  const [error,           setError]           = useState(null)

  useEffect(() => { loadInitial() }, [])
  useEffect(() => { if (selectedCycle) loadAssignments() }, [selectedCycle]) // eslint-disable-line

  async function loadInitial() {
    const [cycleRes, auditorRes] = await Promise.allSettled([
      supabase.from('audit_cycles').select('id, name, is_active').order('created_at', { ascending: false }),
      supabase.from('profiles')
        .select('id, full_name, email, avatar_url, role')
        .eq('is_auditor', true)
        .order('full_name'),
    ])
    const cycleData   = cycleRes.value?.data   || []
    const auditorData = auditorRes.value?.data  || []
    setCycles(cycleData)
    setAuditors(auditorData)
    const active = cycleData.find(c => c.is_active) || cycleData[0]
    setSelectedCycle(active?.id || null)
  }

  async function loadAssignments() {
    if (!selectedCycle) { setLoading(false); return }
    setLoading(true)
    setChanges({})
    const { data, error: err } = await supabase
      .from('unit_instruments')
      .select(`
        id, assigned_auditor,
        units       ( id, name, code, type ),
        instruments ( id, code, name )
      `)
      .eq('cycle_id', selectedCycle)
      .order('unit_id')
    if (!err) setUnitInstruments(data || [])
    setLoading(false)
  }

  function handleAssign(uiId, auditorId) {
    setChanges(prev => ({ ...prev, [uiId]: auditorId }))
    setSaved(false)
  }

  async function saveAll() {
    setSaving(true)
    setError(null)
    try {
      const entries = Object.entries(changes)
      if (entries.length === 0) { setSaved(true); setTimeout(() => setSaved(false), 2000); return }
      const results = await Promise.all(
        entries.map(([id, val]) =>
          supabase.from('unit_instruments')
            .update({ assigned_auditor: val || null })
            .eq('id', id)
        )
      )
      const failed = results.filter(r => r.error)
      if (failed.length) throw new Error(`${failed.length} baris gagal disimpan.`)
      setChanges({})
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      await loadAssignments()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Derived ──────────────────────────────────────────────────
  const grouped = unitInstruments.reduce((acc, ui) => {
    const key = ui.units?.id || 'unknown'
    if (!acc[key]) acc[key] = { unit: ui.units, items: [] }
    acc[key].items.push(ui)
    return acc
  }, {})

  const assignedCount  = unitInstruments.filter(ui => {
    const v = changes[ui.id] !== undefined ? changes[ui.id] : ui.assigned_auditor
    return !!v
  }).length
  const pendingChanges = Object.keys(changes).length

  function auditorName(id) {
    const a = auditors.find(x => x.id === id)
    return a ? (a.full_name || a.email) : '—'
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Plotting Auditor</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tugaskan auditor ke setiap unit dalam siklus audit
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Tersimpan
            </span>
          )}
          {error && <span className="text-sm text-red-500">{error}</span>}
          <button
            onClick={saveAll}
            disabled={saving || pendingChanges === 0}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Save className="h-4 w-4" />}
            {saving
              ? 'Menyimpan...'
              : pendingChanges > 0
                ? `Simpan (${pendingChanges} perubahan)`
                : 'Simpan'}
          </button>
        </div>
      </div>

      {/* ── Cycle selector ──────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-500 shrink-0">Siklus:</label>
        <select
          value={selectedCycle || ''}
          onChange={e => setSelectedCycle(e.target.value)}
          className="rounded border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {cycles.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.is_active ? ' ✓ Aktif' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* ── Stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Penugasan',   value: unitInstruments.length,                    color: 'text-gray-900' },
          { label: 'Sudah Diplot',      value: assignedCount,                             color: 'text-green-600' },
          { label: 'Belum Diplot',      value: unitInstruments.length - assignedCount,    color: 'text-amber-600' },
          { label: 'Auditor Tersedia',  value: auditors.length,                           color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="rounded-md border border-gray-200 bg-white p-4 shadow-sm text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Warning: no auditors ────────────────────────────── */}
      {auditors.length === 0 && !loading && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Belum ada auditor.</strong>{' '}Buka{' '}
            <strong>Manajemen Pengguna</strong> lalu ubah role beberapa user menjadi{' '}
            <em>Auditor</em> terlebih dahulu.
          </div>
        </div>
      )}

      {/* ── Pending changes banner ───────────────────────────── */}
      {pendingChanges > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Ada <strong>{pendingChanges} perubahan belum disimpan</strong>. Klik tombol Simpan untuk menyimpannya.
        </div>
      )}

      {/* ── Assignment table grouped by unit ────────────────── */}
      {loading ? (
        <SkeletonTable rows={6} cols={3} />
      ) : Object.values(grouped).length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-10 text-center">
          <ClipboardList className="h-8 w-8 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">Belum ada penugasan instrumen untuk siklus ini.</p>
          <p className="text-xs text-gray-400 mt-1">
            Tugaskan instrumen ke unit terlebih dahulu melalui halaman Siklus Audit.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.values(grouped).map(({ unit, items }) => {
            const unitAssigned = items.filter(ui => {
              const v = changes[ui.id] !== undefined ? changes[ui.id] : ui.assigned_auditor
              return !!v
            }).length
            const allDone = unitAssigned === items.length

            return (
              <div key={unit?.id}
                className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">

                {/* Unit header */}
                <div className={`flex items-center gap-3 px-5 py-3 border-b border-gray-100 ${allDone ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{unit?.name}</p>
                    <p className="text-xs text-gray-400">{unit?.code} · {unit?.type}</p>
                  </div>
                  <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${
                    allDone
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {unitAssigned}/{items.length} diplot
                  </span>
                </div>

                {/* Instrument rows */}
                <div className="divide-y divide-gray-100">
                  {items.map(ui => {
                    const currentVal = changes[ui.id] !== undefined
                      ? changes[ui.id]
                      : (ui.assigned_auditor || '')
                    const isChanged  = changes[ui.id] !== undefined
                    const hasAuditor = !!currentVal

                    return (
                      <div key={ui.id}
                        className={`flex items-center gap-4 px-5 py-3 transition-colors ${
                          isChanged ? 'bg-blue-50/40' : ''
                        }`}>

                        {/* Instrument number badge */}
                        <div className="flex items-center justify-center w-7 h-7 rounded bg-gray-100 text-gray-600 text-[11px] font-bold shrink-0">
                          {ui.instruments?.code?.replace('INST-', '')}
                        </div>

                        {/* Instrument name */}
                        <p className="flex-1 text-sm text-gray-800 truncate min-w-0">
                          {ui.instruments?.name}
                        </p>

                        {/* Status dot */}
                        <span className={`h-2 w-2 rounded-full shrink-0 ${hasAuditor ? 'bg-green-500' : 'bg-gray-300'}`} />

                        {/* Auditor select */}
                        <select
                          value={currentVal}
                          onChange={e => handleAssign(ui.id, e.target.value)}
                          className={`rounded border text-xs px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] transition-colors ${
                            isChanged
                              ? 'border-blue-400 bg-blue-50 text-blue-800'
                              : hasAuditor
                                ? 'border-green-200 bg-green-50 text-gray-700'
                                : 'border-gray-200 bg-white text-gray-500'
                          }`}
                        >
                          <option value="">— Belum ada auditor —</option>
                          {auditors.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.full_name || a.email}
                            </option>
                          ))}
                        </select>

                        {/* Changed badge */}
                        {isChanged && (
                          <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 rounded px-1.5 py-0.5 shrink-0">
                            ●&nbsp;Diubah
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
