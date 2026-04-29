/**
 * Admin — Manajemen Unit & Penugasan Instrumen
 * CRUD units + assign instruments per unit per cycle.
 */
import { useEffect, useState, useCallback } from 'react'
import { Plus, Building2, Link2, Loader2, X, AlertCircle, Check, Pencil, Trash2, UserCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SkeletonGrid } from '../../components/UI/Skeleton'

export default function UnitManagement() {
  const [units, setUnits] = useState([])
  const [instruments, setInstruments] = useState([])
  const [cycles, setCycles] = useState([])
  const [pimpinanUsers, setPimpinanUsers] = useState([])  // daftar user role=pimpinan
  const [assigningPimpinan, setAssigningPimpinan] = useState(null) // unitId sedang disimpan
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Siklus aktif yang dipilih (untuk modal assign)
  const [selectedCycle, setSelectedCycle] = useState('')

  // Unit form modal (create & edit)
  const [showUnitModal, setShowUnitModal] = useState(false)
  const [editingUnit, setEditingUnit]     = useState(null)   // null = create, object = edit
  const [unitForm, setUnitForm]   = useState({ code: '', name: '', type: 'prodi' })
  const [savingUnit, setSavingUnit] = useState(false)

  // Assign instrument modal
  const [assignTarget, setAssignTarget] = useState(null)
  const [assignments, setAssignments] = useState([])   // unit_instruments rows
  const [toggling, setToggling] = useState(null)       // instrument_id sedang diproses

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [u, i, c, p] = await Promise.allSettled([
        supabase.from('units').select('*, profiles:assigned_pimpinan_id(id, full_name)').eq('is_active', true).order('name'),
        supabase.from('instruments').select('id, code, name').eq('is_active', true).order('code'),
        supabase.from('audit_cycles').select('id, name, academic_year, semester, is_active').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name').eq('role', 'pimpinan').order('full_name'),
      ])

      if (u.status === 'fulfilled') setUnits(u.value.data || [])
      if (i.status === 'fulfilled') setInstruments(i.value.data || [])
      if (p.status === 'fulfilled') setPimpinanUsers(p.value.data || [])
      if (c.status === 'fulfilled') {
        const cycles = c.value.data || []
        setCycles(cycles)
        // Default ke siklus aktif, atau siklus pertama
        const active = cycles.find(x => x.is_active) || cycles[0]
        if (active) setSelectedCycle(active.id)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchAssignments(unitId, cycleId) {
    if (!unitId || !cycleId) { setAssignments([]); return }
    const { data } = await supabase
      .from('unit_instruments')
      .select('id, instrument_id')
      .eq('unit_id', unitId)
      .eq('cycle_id', cycleId)
    setAssignments(data || [])
  }

  async function openAssign(unit) {
    setAssignTarget(unit)
    setAssignments([])
    if (selectedCycle) await fetchAssignments(unit.id, selectedCycle)
  }

  async function handleCycleChange(newCycleId) {
    setSelectedCycle(newCycleId)
    if (assignTarget && newCycleId) {
      await fetchAssignments(assignTarget.id, newCycleId)
    }
  }

  async function toggleAssignment(instrumentId) {
    if (!assignTarget || !selectedCycle) return
    setToggling(instrumentId)
    try {
      const existing = assignments.find(a => a.instrument_id === instrumentId)
      if (existing) {
        await supabase.from('unit_instruments').delete().eq('id', existing.id)
      } else {
        await supabase.from('unit_instruments').insert({
          cycle_id: selectedCycle,
          unit_id: assignTarget.id,
          instrument_id: instrumentId,
        })
      }
      await fetchAssignments(assignTarget.id, selectedCycle)
    } catch (err) {
      alert('Gagal menyimpan: ' + err.message)
    } finally {
      setToggling(null)
    }
  }


  async function handleSaveUnit(e) {
    e.preventDefault()
    setSavingUnit(true)
    try {
      if (editingUnit) {
        // Mode edit
        await supabase.from('units')
          .update({ code: unitForm.code, name: unitForm.name, type: unitForm.type })
          .eq('id', editingUnit.id)
      } else {
        // Mode tambah baru
        await supabase.from('units').insert(unitForm)
      }
      closeUnitModal()
      loadAll()
    } catch (err) {
      alert(err.message)
    } finally {
      setSavingUnit(false)
    }
  }

  function openCreateUnit() {
    setEditingUnit(null)
    setUnitForm({ code: '', name: '', type: 'prodi' })
    setShowUnitModal(true)
  }

  function openEditUnit(unit) {
    setEditingUnit(unit)
    setUnitForm({ code: unit.code, name: unit.name, type: unit.type })
    setShowUnitModal(true)
  }

  function closeUnitModal() {
    setShowUnitModal(false)
    setEditingUnit(null)
    setUnitForm({ code: '', name: '', type: 'prodi' })
  }

  async function handleDeactivateUnit(unit) {
    if (!confirm(`Nonaktifkan unit "${unit.name}"? Unit tidak akan tampil di daftar.`)) return
    await supabase.from('units').update({ is_active: false }).eq('id', unit.id)
    loadAll()
  }

  async function handleAssignPimpinan(unitId, pimpinanId) {
    setAssigningPimpinan(unitId)
    try {
      const { error: e } = await supabase
        .from('units')
        .update({ assigned_pimpinan_id: pimpinanId || null })
        .eq('id', unitId)
      if (e) throw e
      // Update local state
      setUnits(prev => prev.map(u => {
        if (u.id !== unitId) return u
        const pimpinan = pimpinanUsers.find(p => p.id === pimpinanId)
        return { ...u, assigned_pimpinan_id: pimpinanId || null, profiles: pimpinan || null }
      }))
    } catch (err) {
      alert('Gagal assign pimpinan: ' + err.message)
    } finally {
      setAssigningPimpinan(null)
    }
  }

  const currentCycleName = cycles.find(c => c.id === selectedCycle)?.name ?? ''

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Unit & Prodi</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kelola unit auditee dan penugasan instrumen per siklus</p>
        </div>
        <button onClick={openCreateUnit}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="h-4 w-4" /> Tambah Unit
        </button>
      </div>

      {/* Cycle selector */}
      <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-sm font-medium text-gray-600 shrink-0">Siklus Aktif:</span>
        {cycles.length === 0 ? (
          <span className="text-sm text-amber-600 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" />
            Belum ada siklus — buat dulu di menu <strong>Siklus Audit</strong>
          </span>
        ) : (
          <select value={selectedCycle} onChange={e => handleCycleChange(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {cycles.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.is_active ? ' ✓ Aktif' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Units grid */}
      {loading ? (
        <SkeletonGrid cols={3} rows={2} />
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      ) : units.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-sm text-gray-400">Belum ada unit. Klik "+ Tambah Unit" untuk menambahkan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {units.map(unit => (
            <div key={unit.id} className="rounded-md border border-gray-200 bg-white p-4 shadow-sm group">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 shrink-0">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{unit.name}</p>
                  <p className="text-xs text-gray-400">{unit.code} · {unit.type}</p>
                </div>
                {/* Edit & Hapus */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditUnit(unit)}
                    title="Edit unit"
                    className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeactivateUnit(unit)}
                    title="Nonaktifkan unit"
                    className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Assign Pimpinan — inline dropdown */}
              <div className="mt-3 flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <select
                  value={unit.assigned_pimpinan_id ?? ''}
                  onChange={e => handleAssignPimpinan(unit.id, e.target.value)}
                  disabled={assigningPimpinan === unit.id || pimpinanUsers.length === 0}
                  className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60 bg-gray-50"
                >
                  <option value="">— Belum ada Pimpinan —</option>
                  {pimpinanUsers.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
                {assigningPimpinan === unit.id && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />
                )}
              </div>

              <button
                onClick={() => openAssign(unit)}
                disabled={cycles.length === 0}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Link2 className="h-3.5 w-3.5" /> Tugaskan Instrumen
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Unit Create / Edit Modal ──────────────────────────────── */}
      {showUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {editingUnit ? 'Edit Unit' : 'Tambah Unit Baru'}
              </h2>
              <button onClick={closeUnitModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveUnit} className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kode Unit *</label>
                <input required value={unitForm.code}
                  onChange={e => setUnitForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="cth: PRODI-DKV"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nama Unit *</label>
                <input required value={unitForm.name}
                  onChange={e => setUnitForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="cth: Prodi Desain Komunikasi Visual"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipe</label>
                <select value={unitForm.type}
                  onChange={e => setUnitForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="prodi">Prodi</option>
                  <option value="biro">Biro</option>
                  <option value="upt">UPT</option>
                  <option value="lembaga">Lembaga</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-3">
                <button type="button" onClick={closeUnitModal}
                  className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Batal</button>
                <button type="submit" disabled={savingUnit}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                  {savingUnit ? 'Menyimpan...' : editingUnit ? 'Simpan Perubahan' : 'Tambah Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign Instruments Modal ──────────────────────────────── */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Penugasan Instrumen</h2>
                <p className="text-xs text-gray-500">{assignTarget.name}</p>
              </div>
              <button onClick={() => setAssignTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Cycle selector inside modal */}
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 shrink-0">Siklus:</span>
                <select value={selectedCycle} onChange={e => handleCycleChange(e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {cycles.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.is_active ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Warning jika tidak ada siklus */}
            {!selectedCycle && (
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-sm text-amber-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Buat siklus audit terlebih dahulu sebelum menugaskan instrumen.
              </div>
            )}

            {/* Instrument list */}
            <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
              {instruments.map(inst => {
                const assigned = assignments.find(a => a.instrument_id === inst.id)
                const isToggling = toggling === inst.id
                return (
                  <div key={inst.id} className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleAssignment(inst.id)}
                        disabled={!selectedCycle || isToggling}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors
                          ${assigned
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-gray-300 bg-white hover:border-blue-400'
                          }
                          ${(!selectedCycle || isToggling) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        {isToggling
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : assigned && <Check className="h-3 w-3" />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{inst.name}</p>
                        <p className="text-xs text-gray-400">{inst.code}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary + tutup */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {assignments.length} instrumen ditugaskan
              </p>
              <button onClick={() => setAssignTarget(null)}
                className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
