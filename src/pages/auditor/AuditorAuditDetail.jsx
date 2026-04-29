/**
 * Auditor — Detail Audit (Desk Evaluasi)
 *
 * Split pane layout:
 *   Kiri (45%): Jawaban PPEPP auditee per komponen (read-only)
 *   Kanan (55%): Form desk evaluasi auditor per komponen
 *
 * Flow status:
 *   submitted → under_review (otomatis saat dibuka)
 *   under_review → verified (saat auditor submit temuan)
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Loader2, Save, Send, CheckCircle2,
  Circle, Lock, FileText, ExternalLink, AlertCircle,
  Building2, ClipboardList, Info,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { PPEPP_STAGES, computePPEPPScore } from '../../components/PPEPPChecklist'

/* ─── Kategori temuan ───────────────────────────────────────── */
const CATEGORIES = [
  { key: 'sesuai', label: 'Sesuai',  color: 'bg-green-100 text-green-700  border-green-300' },
  { key: 'OB',     label: 'OB',      color: 'bg-blue-100  text-blue-700   border-blue-300'  },
  { key: 'KTS_m',  label: 'KTS Minor', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: 'KTS_M',  label: 'KTS Mayor', color: 'bg-red-100   text-red-700   border-red-300'   },
  { key: 'SPT',    label: 'SPT',     color: 'bg-violet-100 text-violet-700 border-violet-300' },
]

const STATUS_LABEL = {
  submitted:    'Menunggu Audit',
  under_review: 'Sedang Diaudit',
  verified:     'Terverifikasi',
}

/* ─── Score bar (mini) ──────────────────────────────────────── */
function ScorePips({ score, max = 5 }) {
  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-4 rounded-sm ${
            i < score ? 'bg-blue-500' : 'bg-gray-200'
          }`}
        />
      ))}
      <span className="ml-1 text-xs font-bold text-blue-700">{score}/{max}</span>
    </div>
  )
}

/* ─── Auditee PPEPP read-only ───────────────────────────────── */
function AuditeeComponentCard({ component, answers }) {
  const ppepp = answers?.[component.id] || {}
  const score = computePPEPPScore(ppepp)

  async function openFile(filePath) {
    if (!filePath) return
    const { data } = await supabase.storage
      .from('evidence-files')
      .createSignedUrl(filePath, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
      {/* Component header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div>
          <span className="text-[11px] font-bold text-blue-700 bg-blue-100 rounded px-1.5 py-0.5 mr-2">
            {component.code}
          </span>
          <span className="text-sm font-semibold text-gray-900">{component.name}</span>
        </div>
        <ScorePips score={score} />
      </div>

      {/* PPEPP stages */}
      <div className="divide-y divide-gray-50">
        {PPEPP_STAGES.map((stage, idx) => {
          const stageData = ppepp[stage.key] || {}
          const fulfilled = !!stageData.terpenuhi && !!stageData.file_path
          const prevFulfilled = idx === 0 || !!ppepp[PPEPP_STAGES[idx - 1].key]?.terpenuhi

          return (
            <div
              key={stage.key}
              className={`flex items-start gap-3 px-4 py-2.5 text-xs ${
                fulfilled ? 'bg-green-50/50' : !prevFulfilled ? 'opacity-40' : ''
              }`}
            >
              {/* Status icon */}
              <div className="mt-0.5 shrink-0">
                {fulfilled ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                ) : !prevFulfilled ? (
                  <Lock className="h-3.5 w-3.5 text-gray-300" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-gray-300" />
                )}
              </div>

              {/* Stage info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center h-4 w-4 rounded text-[9px] font-bold ${stage.color.bg} ${stage.color.text}`}>
                    {stage.abbr}
                  </span>
                  <span className={`font-medium ${fulfilled ? 'text-green-700' : 'text-gray-500'}`}>
                    {stage.label}
                  </span>
                </div>
                {fulfilled && stageData.file_name && (
                  <button
                    onClick={() => openFile(stageData.file_path)}
                    className="flex items-center gap-1 mt-0.5 text-[11px] text-blue-600 hover:text-blue-800 truncate max-w-full"
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{stageData.file_name}</span>
                    <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Auditor finding form per komponen ─────────────────────── */
function AuditorComponentForm({ component, answers, finding, onChange }) {
  const ppepp = answers?.[component.id] || {}
  const auditeeScore = computePPEPPScore(ppepp)
  const f = finding || { desk_score: null, category: 'sesuai', catatan: '', rekomendasi: '' }

  return (
    <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div>
          <span className="text-[11px] font-bold text-blue-700 bg-blue-100 rounded px-1.5 py-0.5 mr-2">
            {component.code}
          </span>
          <span className="text-sm font-semibold text-gray-900">{component.name}</span>
        </div>
        <div className="text-xs text-gray-500">
          Auditee: <span className="font-semibold text-blue-700">{auditeeScore}/5</span>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Desk Score */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Skor Desk Evaluasi
          </label>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ ...f, desk_score: s })}
                className={`flex-1 rounded py-1.5 text-sm font-bold border transition-colors ${
                  f.desk_score === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {f.desk_score !== null && f.desk_score !== auditeeScore && (
            <p className={`text-[11px] mt-1 ${f.desk_score < auditeeScore ? 'text-amber-600' : 'text-green-600'}`}>
              {f.desk_score < auditeeScore
                ? `↓ Dikoreksi dari ${auditeeScore} ke ${f.desk_score}`
                : `↑ Ditingkatkan dari ${auditeeScore} ke ${f.desk_score}`}
            </p>
          )}
        </div>

        {/* Kategori Temuan */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Kategori Temuan
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                type="button"
                onClick={() => onChange({ ...f, category: cat.key })}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                  f.category === cat.key
                    ? cat.color + ' ring-2 ring-offset-1 ' +
                      (cat.key === 'KTS_M' ? 'ring-red-400' :
                       cat.key === 'KTS_m' ? 'ring-amber-400' :
                       cat.key === 'OB'    ? 'ring-blue-400' :
                       cat.key === 'SPT'   ? 'ring-violet-400' : 'ring-green-400')
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Catatan */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Catatan Temuan
          </label>
          <textarea
            value={f.catatan || ''}
            onChange={e => onChange({ ...f, catatan: e.target.value })}
            placeholder={f.category === 'sesuai'
              ? 'Opsional — tambahkan catatan jika perlu'
              : 'Jelaskan temuan yang ditemukan...'}
            rows={2}
            className="w-full rounded border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Rekomendasi */}
        {f.category !== 'sesuai' && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Rekomendasi
            </label>
            <textarea
              value={f.rekomendasi || ''}
              onChange={e => onChange({ ...f, rekomendasi: e.target.value })}
              placeholder="Rekomendasi tindak lanjut..."
              rows={2}
              className="w-full rounded border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function AuditorAuditDetail() {
  const { unitInstrumentId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [unitInstrument, setUnitInstrument] = useState(null)
  const [components,     setComponents]     = useState([])
  const [submission,     setSubmission]     = useState(null)
  const [finding,        setFinding]        = useState(null) // existing audit_finding
  const [rubricResults,  setRubricResults]  = useState({})  // { comp_id: {desk_score, category, catatan, rekomendasi} }
  const [summary,        setSummary]        = useState('')
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [saved,          setSaved]          = useState(false)
  const [error,          setError]          = useState(null)

  // Split pane
  const [leftWidth,  setLeftWidth]  = useState(45)
  const isDragging   = useRef(false)
  const containerRef = useRef(null)
  const startX       = useRef(0)
  const startW       = useRef(0)

  function startDrag(e) {
    isDragging.current = true
    startX.current = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX
    startW.current = leftWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMove(ev) {
      if (!isDragging.current) return
      const cx = ev.type === 'touchmove' ? ev.touches[0].clientX : ev.clientX
      const dx = cx - startX.current
      const cw = containerRef.current?.offsetWidth || 1
      setLeftWidth(Math.min(65, Math.max(30, startW.current + (dx / cw) * 100)))
    }
    function stopDrag() {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', stopDrag)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', stopDrag)
  }

  useEffect(() => { if (unitInstrumentId && user) loadData() }, [unitInstrumentId, user])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      // 1. Get unit_instrument info
      const { data: ui, error: uiErr } = await supabase
        .from('unit_instruments')
        .select(`
          id, cycle_id,
          units        ( id, name, code ),
          instruments  ( id, code, name, pdf_storage_path ),
          audit_cycles ( id, name ),
          submissions  ( id, status, answers, updated_at, submitted_at )
        `)
        .eq('id', unitInstrumentId)
        .single()
      if (uiErr) throw uiErr
      setUnitInstrument(ui)

      const sub = ui.submissions?.[0] || null
      setSubmission(sub)

      // 2. Instrument components
      const { data: comps, error: compErr } = await supabase
        .from('instrument_components')
        .select('id, code, name, sort_order, rubric_schema')
        .eq('instrument_id', ui.instruments.id)
        .order('sort_order')
      if (compErr) throw compErr
      setComponents(comps || [])

      // 3. Existing finding (this auditor)
      if (sub) {
        const { data: f } = await supabase
          .from('audit_findings')
          .select('*')
          .eq('submission_id', sub.id)
          .eq('auditor_id', user.id)
          .maybeSingle()

        if (f) {
          setFinding(f)
          setRubricResults(f.rubric_results || {})
          setSummary(f.summary || '')
        }

        // 4. Auto-update status to under_review if submitted
        if (sub.status === 'submitted') {
          await supabase
            .from('submissions')
            .update({ status: 'under_review' })
            .eq('id', sub.id)
          setSubmission(s => ({ ...s, status: 'under_review' }))
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Overall category = most severe across all components
  function computeOverallCategory() {
    const priority = { KTS_M: 4, KTS_m: 3, SPT: 2, OB: 1, sesuai: 0 }
    let max = 0
    let cat = 'sesuai'
    for (const v of Object.values(rubricResults)) {
      const p = priority[v.category] ?? 0
      if (p > max) { max = p; cat = v.category }
    }
    return cat === 'sesuai' ? 'OB' : cat // audit_findings.category enum doesn't have 'sesuai'
  }

  async function handleSave() {
    if (!submission) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const payload = {
        submission_id:  submission.id,
        auditor_id:     user.id,
        category:       computeOverallCategory(),
        rubric_results: rubricResults,
        summary,
      }
      if (finding?.id) {
        const { error: e } = await supabase
          .from('audit_findings')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', finding.id)
        if (e) throw e
      } else {
        const { data: newF, error: e } = await supabase
          .from('audit_findings')
          .insert(payload)
          .select()
          .single()
        if (e) throw e
        setFinding(newF)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError('Gagal menyimpan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    if (!submission) return
    // Validate: all components must have desk_score
    const missing = components.filter(c => rubricResults[c.id]?.desk_score == null)
    if (missing.length > 0) {
      setError(`Lengkapi skor desk evaluasi untuk: ${missing.map(c => c.code).join(', ')}`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // Save finding
      await handleSave()
      // Update submission status to verified
      const { error: e } = await supabase
        .from('submissions')
        .update({ status: 'verified' })
        .eq('id', submission.id)
      if (e) throw e
      setSubmission(s => ({ ...s, status: 'verified' }))
      navigate('/auditor/assignments')
    } catch (err) {
      setError('Gagal submit: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-500">Memuat data audit...</span>
      </div>
    )
  }

  if (!unitInstrument || !submission) {
    return (
      <div className="max-w-lg rounded-md border border-amber-200 bg-amber-50 p-6">
        <AlertCircle className="h-5 w-5 text-amber-500 mb-2" />
        <p className="text-sm font-medium text-amber-800">Data tidak ditemukan</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-sm text-blue-600 hover:underline">← Kembali</button>
      </div>
    )
  }

  const answers = submission.answers || {}
  const isVerified = submission.status === 'verified'

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ── Top Bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/auditor/assignments')}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-semibold text-gray-900">
                {unitInstrument.units?.name}
              </p>
              <span className="text-gray-300">·</span>
              <ClipboardList className="h-4 w-4 text-gray-400" />
              <p className="text-sm text-gray-700">{unitInstrument.instruments?.name}</p>
            </div>
            <p className="text-xs text-gray-400">{unitInstrument.audit_cycles?.name}</p>
          </div>
        </div>

        {/* Status + actions */}
        <div className="flex items-center gap-3">
          {error && (
            <p className="text-xs text-red-600 max-w-xs truncate">{error}</p>
          )}
          {saved && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Tersimpan
            </p>
          )}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isVerified
              ? 'bg-green-100 text-green-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {STATUS_LABEL[submission.status] ?? submission.status}
          </span>
          {!isVerified && (
            <>
              <button
                onClick={handleSave}
                disabled={saving || submitting}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Simpan Draft
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || submitting}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 shadow-sm disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Submit Temuan
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Split Pane ───────────────────────────────────────── */}
      {components.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Info className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">Instrumen ini belum memiliki komponen penilaian</p>
            <p className="text-xs text-gray-400 mt-1">Super Admin perlu menambahkan butir penilaian terlebih dahulu.</p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="flex flex-1 overflow-hidden">

          {/* LEFT: Auditee answers */}
          <div
            className="overflow-y-auto border-r border-gray-200 bg-gray-50"
            style={{ width: `${leftWidth}%` }}
          >
            <div className="sticky top-0 z-10 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                📋 Jawaban Evaluasi Diri Auditee
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Submitted: {submission.submitted_at
                  ? new Date(submission.submitted_at).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })
                  : '—'}
              </p>
            </div>
            <div className="p-3 space-y-3">
              {components.map(comp => (
                <AuditeeComponentCard
                  key={comp.id}
                  component={comp}
                  answers={answers}
                />
              ))}
            </div>
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={startDrag}
            className="w-1 cursor-col-resize bg-gray-200 hover:bg-blue-400 transition-colors shrink-0"
          />

          {/* RIGHT: Auditor form */}
          <div
            className="overflow-y-auto bg-white"
            style={{ width: `${100 - leftWidth}%` }}
          >
            <div className="sticky top-0 z-10 px-4 py-2.5 bg-blue-50 border-b border-blue-100 shadow-sm">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                ✏️ Desk Evaluasi Auditor
              </p>
              <p className="text-[11px] text-blue-500 mt-0.5">
                Isi skor & temuan per komponen, lalu Submit Temuan untuk memfinalisasi.
              </p>
            </div>

            <div className="p-3 space-y-3">
              {components.map(comp => (
                <AuditorComponentForm
                  key={comp.id}
                  component={comp}
                  answers={answers}
                  finding={rubricResults[comp.id] || null}
                  onChange={val => setRubricResults(r => ({ ...r, [comp.id]: val }))}
                />
              ))}

              {/* Summary */}
              <div className="rounded-md border border-gray-200 bg-white p-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Catatan / Kesimpulan Keseluruhan (opsional)
                </label>
                <textarea
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  placeholder="Ringkasan hasil desk evaluasi secara keseluruhan..."
                  rows={3}
                  className="w-full rounded border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
