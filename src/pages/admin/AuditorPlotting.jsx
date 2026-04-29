/**
 * Admin — Plotting Auditor (multi-auditor per unit_instrument)
 * Setiap instrument dalam unit bisa diplotkan ke lebih dari satu auditor.
 * Data disimpan ke tabel junction: unit_instrument_auditors
 */
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Users, Save, AlertCircle, Loader2, CheckCircle2,
  Building2, ClipboardList, Plus, X, Mic2,
} from 'lucide-react'
import { SkeletonTable } from '../../components/UI/Skeleton'

/* ─── Dropdown pencarian auditor per baris ─────────────────── */
function AuditorDropdown({ auditors, assignedIds, onAdd, onClose }) {
  const [search, setSearch] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const available = auditors.filter(a =>
    !assignedIds.includes(a.id) &&
    (a.full_name || a.email).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="absolute z-40 mt-1 w-56 rounded-md border border-gray-200 bg-white shadow-lg">
      <div className="p-2 border-b border-gray-100">
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari auditor…"
          className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="max-h-44 overflow-y-auto">
        {available.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-gray-400">
            {auditors.length === 0 ? 'Belum ada auditor aktif' : 'Semua auditor sudah ditambahkan'}
          </p>
        ) : available.map(a => (
          <button
            key={a.id}
            onClick={() => { onAdd(a); onClose() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-blue-50 transition-colors"
          >
            <div className="h-6 w-6 rounded-full bg-green-100 text-green-700 text-[10px] font-bold flex items-center justify-center shrink-0">
              {(a.full_name || a.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-800 truncate">{a.full_name || a.email}</p>
              <p className="text-gray-400 truncate">{a.email}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Main ──────────────────────────────────────────────────── */
export default function AuditorPlotting() {
  const [cycles,          setCycles]          = useState([])
  const [selectedCycle,   setSelectedCycle]   = useState(null)
  const [unitInstruments, setUnitInstruments] = useState([])
  const [auditors,        setAuditors]        = useState([])
  // localAuditors: { [unit_instrument_id]: [{ id, full_name, email, role }, ...] }
  const [localAuditors,   setLocalAuditors]   = useState({})
  const [savedAuditors,   setSavedAuditors]   = useState({}) // untuk deteksi perubahan
  const [loading,         setLoading]         = useState(true)
  const [saving,          setSaving]          = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [error,           setError]           = useState(null)
  const [openDropdown,    setOpenDropdown]    = useState(null) // unit_instrument_id

  useEffect(() => { loadInitial() }, [])
  useEffect(() => { if (selectedCycle) loadAssignments() }, [selectedCycle]) // eslint-disable-line

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (!e.target.closest('[data-dropdown-container]')) setOpenDropdown(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function loadInitial() {
    const [cycleRes, auditorRes] = await Promise.allSettled([
      supabase.from('audit_cycles').select('id, name, is_active').order('created_at', { ascending: false }),
      supabase.from('profiles')
        .select('id, full_name, email, role')
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

    const [uiRes, assignRes] = await Promise.allSettled([
      supabase
        .from('unit_instruments')
        .select(`id, units(id, name, code, type), instruments(id, code, name)`)
        .eq('cycle_id', selectedCycle)
        .order('unit_id'),
      supabase
        .from('unit_instrument_auditors')
        .select(`unit_instrument_id, auditor_id, profiles:auditor_id(id, full_name, email, role)`)
        .in(
          'unit_instrument_id',
          // sub-fetch unit_instrument ids for this cycle
          (await supabase
            .from('unit_instruments')
            .select('id')
            .eq('cycle_id', selectedCycle)
          ).data?.map(r => r.id) || []
        ),
    ])

    const uis       = uiRes.value?.data    || []
    const rawAssign = assignRes.value?.data || []

    setUnitInstruments(uis)

    // Build map { ui_id: [auditor profile, ...] }
    const map = {}
    uis.forEach(ui => { map[ui.id] = [] })
    rawAssign.forEach(row => {
      if (map[row.unit_instrument_id] && row.profiles) {
        map[row.unit_instrument_id].push(row.profiles)
      }
    })
    setLocalAuditors(structuredClone(map))
    setSavedAuditors(structuredClone(map))
    setLoading(false)
  }

  function addAuditor(uiId, auditorProfile) {
    setLocalAuditors(prev => ({
      ...prev,
      [uiId]: [...(prev[uiId] || []), auditorProfile],
    }))
  }

  function removeAuditor(uiId, auditorId) {
    setLocalAuditors(prev => ({
      ...prev,
      [uiId]: (prev[uiId] || []).filter(a => a.id !== auditorId),
    }))
  }

  // Detect if anything changed
  function hasChanges() {
    for (const uiId of Object.keys(localAuditors)) {
      const local  = (localAuditors[uiId]  || []).map(a => a.id).sort().join(',')
      const saved  = (savedAuditors[uiId]  || []).map(a => a.id).sort().join(',')
      if (local !== saved) return true
    }
    return false
  }

  // Count pending changes
  function pendingCount() {
    let count = 0
    for (const uiId of Object.keys(localAuditors)) {
      const local = (localAuditors[uiId]  || []).map(a => a.id).sort().join(',')
      const saved = (savedAuditors[uiId]  || []).map(a => a.id).sort().join(',')
      if (local !== saved) count++
    }
    return count
  }

  async function saveAll() {
    setSaving(true)
    setError(null)
    try {
      const changedUiIds = Object.keys(localAuditors).filter(uiId => {
        const local = (localAuditors[uiId] || []).map(a => a.id).sort().join(',')
        const saved = (savedAuditors[uiId] || []).map(a => a.id).sort().join(',')
        return local !== saved
      })

      await Promise.all(changedUiIds.map(async uiId => {
        // Delete existing assignments for this ui
        await supabase
          .from('unit_instrument_auditors')
          .delete()
          .eq('unit_instrument_id', uiId)

        // Insert new assignments
        const newAuditors = localAuditors[uiId] || []
        if (newAuditors.length > 0) {
          const { error: insErr } = await supabase
            .from('unit_instrument_auditors')
            .insert(newAuditors.map(a => ({
              unit_instrument_id: uiId,
              auditor_id:         a.id,
            })))
          if (insErr) throw insErr
        }
      }))

      setSavedAuditors(structuredClone(localAuditors))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
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

  const totalAssigned  = Object.values(localAuditors).filter(arr => arr.length > 0).length
  const pending         = pendingCount()

  return (
    <div className="max-w-6xl space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Plotting Auditor</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tugaskan satu atau beberapa auditor ke setiap instrumen dalam siklus audit
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Tersimpan
            </span>
          )}
          {error && <span className="text-sm text-red-500 max-w-xs truncate">{error}</span>}
          <button
            onClick={saveAll}
            disabled={saving || !hasChanges()}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Menyimpan…' : pending > 0 ? `Simpan (${pending} diubah)` : 'Simpan'}
          </button>
        </div>
      </div>

      {/* ── Siklus selector ─────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-500 shrink-0">Siklus:</label>
        <select
          value={selectedCycle || ''}
          onChange={e => setSelectedCycle(e.target.value)}
          className="rounded border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {cycles.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.is_active ? ' ✓ Aktif' : ''}</option>
          ))}
        </select>
      </div>

      {/* ── Stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Instrumen', value: unitInstruments.length,                       color: 'text-gray-900' },
          { label: 'Sudah Diplot',    value: totalAssigned,                                color: 'text-green-600' },
          { label: 'Belum Diplot',    value: unitInstruments.length - totalAssigned,       color: 'text-amber-600' },
          { label: 'Auditor Aktif',   value: auditors.length,                              color: 'text-blue-600' },
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
          <span>
            <strong>Belum ada auditor aktif.</strong> Buka <strong>Manajemen Pengguna</strong> →
            Edit user → aktifkan toggle <em>Fungsi Auditor</em>.
          </span>
        </div>
      )}

      {/* ── Pending banner ───────────────────────────────────── */}
      {pending > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Ada <strong className="mx-1">{pending} instrumen</strong> dengan perubahan yang belum disimpan.
        </div>
      )}

      {/* ── Assignment grid ─────────────────────────────────── */}
      {loading ? (
        <SkeletonTable rows={6} cols={3} />
      ) : Object.values(grouped).length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-10 text-center">
          <ClipboardList className="h-8 w-8 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">Belum ada penugasan instrumen untuk siklus ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.values(grouped).map(({ unit, items }) => {
            const unitPlotted        = items.filter(ui => (localAuditors[ui.id] || []).length > 0).length
            const totalUnitAuditors  = items.reduce((sum, ui) => sum + (localAuditors[ui.id] || []).length, 0)
            const allDone            = unitPlotted === items.length

            return (
              <div key={unit?.id} className="rounded-md border border-gray-200 bg-white shadow-sm overflow-visible">

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
                    totalUnitAuditors > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {totalUnitAuditors === 0 ? 'Belum Diplot' : `${totalUnitAuditors} Auditor`}
                  </span>
                </div>

                {/* Instrument rows */}
                <div className="divide-y divide-gray-100">
                  {items.map(ui => {
                    const assigned   = localAuditors[ui.id] || []
                    const savedList  = savedAuditors[ui.id]  || []
                    const isChanged  = assigned.map(a => a.id).sort().join(',') !== savedList.map(a => a.id).sort().join(',')
                    const isOpen     = openDropdown === ui.id

                    return (
                      <div key={ui.id} className={`flex items-start gap-4 px-5 py-3 transition-colors ${isChanged ? 'bg-blue-50/30' : ''}`}>

                        {/* Instrument badge */}
                        <div className="flex items-center justify-center w-7 h-7 rounded bg-gray-100 text-gray-600 text-[11px] font-bold shrink-0 mt-0.5">
                          {ui.instruments?.code?.replace('INST-', '')}
                        </div>

                        {/* Instrument name */}
                        <p className="w-44 shrink-0 text-sm text-gray-800 truncate pt-1">{ui.instruments?.name}</p>

                        {/* Auditor chips + add button */}
                        <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[32px]">
                          {assigned.map(a => (
                            <span key={a.id}
                              className="inline-flex items-center gap-1.5 rounded-full bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 border border-green-200"
                            >
                              <Mic2 className="h-3 w-3" />
                              {a.full_name || a.email}
                              <button
                                onClick={() => removeAuditor(ui.id, a.id)}
                                className="ml-0.5 text-green-500 hover:text-red-600 transition-colors rounded-full hover:bg-red-50 p-0.5"
                                title="Hapus auditor ini"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))}

                          {/* Add button + dropdown */}
                          <div data-dropdown-container className="relative">
                            <button
                              onClick={() => setOpenDropdown(isOpen ? null : ui.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                              {assigned.length === 0 ? 'Tambah Auditor' : 'Tambah'}
                            </button>

                            {isOpen && (
                              <AuditorDropdown
                                auditors={auditors}
                                assignedIds={assigned.map(a => a.id)}
                                onAdd={auditor => addAuditor(ui.id, auditor)}
                                onClose={() => setOpenDropdown(null)}
                              />
                            )}
                          </div>
                        </div>

                        {/* Changed indicator */}
                        {isChanged && (
                          <span className="shrink-0 text-[10px] font-semibold text-blue-600 bg-blue-100 rounded px-1.5 py-0.5 mt-1">
                            ● Diubah
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
