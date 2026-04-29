/**
 * Pimpinan — RTM Detail (Isi Keputusan)
 * Split pane:
 *   Kiri: Daftar temuan per unit (hanya komponen dengan temuan bukan 'sesuai')
 *   Kanan: Form keputusan RTM untuk komponen terpilih
 */
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Loader2, Save, Check, AlertCircle,
  Building2, ChevronDown, ChevronRight, Calendar,
  ClipboardList, FileText,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const CATEGORY_COLOR = {
  KTS_M:  'bg-red-100 text-red-700 border-red-200',
  KTS_m:  'bg-amber-100 text-amber-700 border-amber-200',
  OB:     'bg-blue-100 text-blue-700 border-blue-200',
  SPT:    'bg-violet-100 text-violet-700 border-violet-200',
  sesuai: 'bg-green-100 text-green-700 border-green-200',
}
const CATEGORY_LABEL = { KTS_M: 'KTS Mayor', KTS_m: 'KTS Minor', OB: 'OB', SPT: 'SPT', sesuai: 'Sesuai' }

export default function RTMDetail() {
  const { rtmId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [rtm,        setRtm]        = useState(null)
  const [unitGroups, setUnitGroups] = useState([]) // [{unit, instrument, components:[{comp, finding, rtmFinding}]}]
  const [selected,   setSelected]   = useState(null) // { unitId, compId, compCode, compName, finding, rtmFinding }
  const [formData,   setFormData]   = useState({ keputusan: '', batas_waktu: '' })
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState(null)
  const [expanded,   setExpanded]   = useState({}) // { unitId: bool }

  // Split pane
  const [leftW, setLeftW] = useState(40)
  const containerRef = useRef(null)

  useEffect(() => { if (rtmId && user) loadData() }, [rtmId, user])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      // 1. Load RTM
      const { data: rtmData, error: e1 } = await supabase
        .from('rtm_sessions')
        .select('*, audit_cycles(id, name, academic_year)')
        .eq('id', rtmId)
        .single()
      if (e1) throw e1
      setRtm(rtmData)

      // 2. Load audit_findings dalam siklus ini (semua unit yang verified)
      const { data: findings, error: e2 } = await supabase
        .from('audit_findings')
        .select(`
          id, category, rubric_results, summary,
          submissions (
            id, status,
            unit_instruments (
              id,
              units ( id, name, code, assigned_pimpinan_id ),
              instruments ( id, code, name ),
              audit_cycles ( id )
            )
          )
        `)
        .eq('submissions.unit_instruments.audit_cycles.id', rtmData.cycle_id)
      if (e2) throw e2

      // 3. Load existing rtm_findings untuk RTM ini
      const { data: existingRtmFindings } = await supabase
        .from('rtm_findings')
        .select('*')
        .eq('rtm_id', rtmId)

      const rtmFindingMap = {}
      for (const rf of existingRtmFindings || []) {
        rtmFindingMap[`${rf.unit_id}_${rf.component_id}`] = rf
      }

      // 4. Load instrument_components untuk tiap instrumen
      const instrumentIds = [...new Set(
        (findings || [])
          .map(f => f.submissions?.unit_instruments?.instruments?.id)
          .filter(Boolean)
      )]
      const { data: components } = await supabase
        .from('instrument_components')
        .select('id, code, name, sort_order, instrument_id')
        .in('instrument_id', instrumentIds.length ? instrumentIds : ['none'])
        .order('sort_order')

      const compsByInstrument = {}
      for (const c of components || []) {
        if (!compsByInstrument[c.instrument_id]) compsByInstrument[c.instrument_id] = []
        compsByInstrument[c.instrument_id].push(c)
      }

      // 5. Build unit groups (filter: hanya scope pimpinan yang login)
      const groups = []
      for (const f of findings || []) {
        const ui = f.submissions?.unit_instruments
        if (!ui) continue
        const unit       = ui.units
        const instrument = ui.instruments
        if (!unit || !instrument) continue

        // Filter: hanya unit yang assigned ke pimpinan ini
        if (unit.assigned_pimpinan_id !== user.id) continue

        const rubric = f.rubric_results || {}
        const comps  = compsByInstrument[instrument.id] || []

        // Hanya tampilkan komponen yang punya temuan bukan 'sesuai'
        const relevantComps = comps
          .filter(c => {
            const cat = rubric[c.id]?.category
            return cat && cat !== 'sesuai'
          })
          .map(c => ({
            comp:       c,
            finding:    f,
            deskScore:  rubric[c.id]?.desk_score,
            category:   rubric[c.id]?.category,
            catatan:    rubric[c.id]?.catatan,
            rtmFinding: rtmFindingMap[`${unit.id}_${c.id}`] || null,
          }))

        if (relevantComps.length === 0) continue

        // Merge jika unit sudah ada
        const existing = groups.find(g => g.unit.id === unit.id && g.instrument.id === instrument.id)
        if (existing) {
          existing.components.push(...relevantComps)
        } else {
          groups.push({ unit, instrument, finding: f, components: relevantComps })
          setExpanded(e => ({ ...e, [unit.id]: true }))
        }
      }

      setUnitGroups(groups)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function selectComponent(item) {
    setSelected(item)
    setFormData({
      keputusan:   item.rtmFinding?.keputusan   || '',
      batas_waktu: item.rtmFinding?.batas_waktu || '',
    })
    setSaved(false)
  }

  async function handleSave() {
    if (!selected || !formData.keputusan.trim()) {
      setError('Keputusan RTM wajib diisi')
      return
    }
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const payload = {
        rtm_id:        rtmId,
        unit_id:       selected.unitId,
        instrument_id: selected.instrumentId,
        component_id:  selected.comp.id,
        keputusan:     formData.keputusan,
        batas_waktu:   formData.batas_waktu || null,
        updated_at:    new Date().toISOString(),
      }

      let savedRf
      if (selected.rtmFinding?.id) {
        const { data, error: e } = await supabase
          .from('rtm_findings')
          .update(payload)
          .eq('id', selected.rtmFinding.id)
          .select().single()
        if (e) throw e
        savedRf = data
      } else {
        const { data, error: e } = await supabase
          .from('rtm_findings')
          .insert(payload)
          .select().single()
        if (e) throw e
        savedRf = data
      }

      // Update local state
      setUnitGroups(prev => prev.map(g => {
        if (g.unit.id !== selected.unitId) return g
        return {
          ...g,
          components: g.components.map(c =>
            c.comp.id === selected.comp.id
              ? { ...c, rtmFinding: savedRf }
              : c
          ),
        }
      }))
      setSelected(s => ({ ...s, rtmFinding: savedRf }))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function startDrag(e) {
    const startX = e.clientX
    const startW = leftW
    const cw = containerRef.current?.offsetWidth || 1
    function onMove(ev) {
      const dx = ev.clientX - startX
      setLeftW(Math.min(65, Math.max(30, startW + (dx / cw) * 100)))
    }
    function stop() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', stop)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', stop)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
      <span className="text-sm text-gray-500">Memuat data RTM...</span>
    </div>
  )

  const isPublished = rtm?.is_published
  const totalComps  = unitGroups.reduce((s, g) => s + g.components.length, 0)
  const filled      = unitGroups.reduce((s, g) => s + g.components.filter(c => c.rtmFinding).length, 0)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/rtm')}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-sm font-semibold text-gray-900">{rtm?.title}</p>
            <p className="text-xs text-gray-400">
              {rtm?.audit_cycles?.name} · Keputusan terisi: {filled}/{totalComps}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isPublished && (
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">
              ✅ Published — Read Only
            </span>
          )}
          {error && <p className="text-xs text-red-600 max-w-xs truncate">{error}</p>}
        </div>
      </div>

      {/* Split pane */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">

        {/* LEFT: Unit + Component list */}
        <div className="overflow-y-auto bg-gray-50 border-r border-gray-200" style={{ width: `${leftW}%` }}>
          <div className="sticky top-0 z-10 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              📋 Temuan Per Unit (scope Anda)
            </p>
          </div>
          {unitGroups.length === 0 ? (
            <div className="p-6 text-center">
              <ClipboardList className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Tidak ada temuan pada unit yang Anda supervisi</p>
              <p className="text-xs text-gray-400 mt-1">Pastikan unit sudah di-assign ke Anda di UnitManagement.</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {unitGroups.map(group => (
                <div key={group.unit.id + group.instrument.id}
                  className="rounded-md border border-gray-200 bg-white overflow-hidden">
                  {/* Unit header */}
                  <button
                    onClick={() => setExpanded(e => ({ ...e, [group.unit.id]: !e[group.unit.id] }))}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-left"
                  >
                    <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{group.unit.name}</p>
                      <p className="text-[11px] text-gray-400">{group.instrument.name}</p>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0">
                      {group.components.filter(c => c.rtmFinding).length}/{group.components.length}
                    </span>
                    {expanded[group.unit.id]
                      ? <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
                      : <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
                    }
                  </button>

                  {/* Components */}
                  {expanded[group.unit.id] && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {group.components.map(item => {
                        const isSelected = selected?.comp.id === item.comp.id && selected?.unitId === group.unit.id
                        const hasFinding = !!item.rtmFinding
                        return (
                          <button
                            key={item.comp.id}
                            onClick={() => selectComponent({
                              ...item,
                              unitId:       group.unit.id,
                              instrumentId: group.instrument.id,
                            })}
                            className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors ${
                              isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${hasFinding ? 'bg-green-400' : 'bg-gray-300'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">
                                [{item.comp.code}] {item.comp.name}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`rounded px-1 py-0.5 text-[10px] font-medium border ${CATEGORY_COLOR[item.category]}`}>
                                  {CATEGORY_LABEL[item.category]}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  Skor: {item.deskScore ?? '—'}/5
                                </span>
                              </div>
                            </div>
                            {isSelected && <ChevronRight className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drag handle */}
        <div onMouseDown={startDrag}
          className="w-1 cursor-col-resize bg-gray-200 hover:bg-blue-400 transition-colors shrink-0" />

        {/* RIGHT: Form keputusan */}
        <div className="flex-1 overflow-y-auto bg-white">
          {!selected ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">Pilih komponen dari daftar kiri</p>
                <p className="text-xs text-gray-300 mt-1">untuk mengisi keputusan RTM</p>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Komponen info */}
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-100 rounded px-1.5 py-0.5">
                    {selected.comp.code}
                  </span>
                  <p className="text-sm font-semibold text-gray-900">{selected.comp.name}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className={`rounded px-2 py-0.5 border text-xs font-medium ${CATEGORY_COLOR[selected.category]}`}>
                    {CATEGORY_LABEL[selected.category]}
                  </span>
                  <span>Skor Desk: <strong>{selected.deskScore ?? '—'}/5</strong></span>
                </div>
                {selected.catatan && (
                  <div className="mt-2 rounded bg-white border border-gray-200 px-3 py-2">
                    <p className="text-[11px] font-semibold text-gray-500 mb-0.5">Catatan Auditor</p>
                    <p className="text-xs text-gray-700">{selected.catatan}</p>
                  </div>
                )}
              </div>

              {/* Form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Keputusan RTM <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.keputusan}
                    onChange={e => setFormData(f => ({ ...f, keputusan: e.target.value }))}
                    disabled={isPublished}
                    placeholder="Tulis keputusan/instruksi RTM untuk butir ini..."
                    rows={5}
                    className="w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Batas Waktu RTL
                  </label>
                  <input
                    type="date"
                    value={formData.batas_waktu}
                    onChange={e => setFormData(f => ({ ...f, batas_waktu: e.target.value }))}
                    disabled={isPublished}
                    className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                  />
                </div>

                {!isPublished && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Save className="h-3.5 w-3.5" />}
                      Simpan Keputusan
                    </button>
                    {saved && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Tersimpan
                      </span>
                    )}
                    {error && (
                      <span className="text-xs text-red-600">{error}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
