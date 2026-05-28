/**
 * Auditee — Form Evaluasi Diri PPEPP + Teks
 *
 * Layout split:
 *   Kiri (40%) : PDF instrumen (iframe Supabase Storage)
 *   Kanan (60%): Form PPEPP / Teks per butir penilaian (scrollable)
 *
 * Scoring PPEPP: kumulatif sequential (0–5 per butir)
 * Scoring Teks : 5 jika sudah diisi teks + upload bukti
 * Bukti: wajib upload per tahap PPEPP atau 1 PDF untuk teks
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, Send, AlertCircle, Loader2, ChevronLeft, BarChart2, ClipboardCheck, FileText, ExternalLink, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import PDFViewer from '../../components/PDFViewer'
import PPEPPChecklist, { computePPEPPScore } from '../../components/PPEPPChecklist'
import FileUpload from '../../components/FileUpload'
import StatusBadge from '../../components/StatusBadge'

/* ─── Kategori map ─────────────────────────────────────────── */
const CATEGORY_MAP = {
  KTS_M:  { label: 'KTS Mayor',        color: 'bg-red-100    text-red-700'    },
  KTS_m:  { label: 'KTS Minor',        color: 'bg-amber-100  text-amber-700'  },
  OB:     { label: 'Observasi',        color: 'bg-blue-100   text-blue-700'   },
  SPT:    { label: 'Saran Perbaikan',  color: 'bg-violet-100 text-violet-700' },
  sesuai: { label: 'Sesuai',          color: 'bg-green-100  text-green-700'  },
}

/* ─── Helper: skor per komponen berdasarkan tipe ────────────── */
function computeComponentScore(comp, answer) {
  const answerType = comp.rubric_schema?.answer_type || 'ppepp'
  if (answerType === 'text') {
    // Teks: skor 5 jika teks diisi DAN file diupload
    return (answer?.text_answer && answer?.file_path) ? 5 : 0
  }
  return computePPEPPScore(answer)
}

/* ─── Hasil desk evaluasi dari SEMUA auditor per komponen ───── */
function FindingsPerAuditor({ compId, findingsList }) {
  // findingsList = array of { auditor_name, rubric_results, ... }
  const relevant = (findingsList || []).filter(f => f.rubric_results?.[compId])
  if (relevant.length === 0) return null

  return (
    <div className="space-y-2 mt-2">
      {relevant.map((finding, idx) => {
        const f = finding.rubric_results[compId]
        const cat = CATEGORY_MAP[f.category] || { label: f.category ?? '—', color: 'bg-gray-100 text-gray-600' }
        const deskScore = f.desk_score ?? null
        const isSaran = finding._type === 'saran'

        return (
          <div key={finding.id || idx}
            className={`rounded-md border px-4 py-3 space-y-2 ${
              isSaran
                ? 'border-amber-200 bg-amber-50'
                : 'border-emerald-200 bg-emerald-50'
            }`}>
            <div className="flex items-center gap-2 flex-wrap">
              <User className={`h-3.5 w-3.5 shrink-0 ${isSaran ? 'text-amber-600' : 'text-emerald-600'}`} />
              <span className={`text-xs font-semibold ${isSaran ? 'text-amber-700' : 'text-emerald-700'}`}>
                {isSaran ? 'Saran Perbaikan' : 'Hasil Desk Evaluasi'} — {finding.auditor_name || 'Auditor'}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cat.color}`}>
                {cat.label}
              </span>
              {deskScore !== null && (
                <span className={`text-xs font-bold ${isSaran ? 'text-amber-800' : 'text-emerald-800'}`}>
                  Skor Desk: {deskScore}/5
                </span>
              )}
            </div>
            {f.catatan && (
              <div>
                <p className={`text-[11px] font-semibold ${isSaran ? 'text-amber-600' : 'text-emerald-600'}`}>Catatan Temuan</p>
                <p className="text-xs text-gray-700 leading-relaxed">{f.catatan}</p>
              </div>
            )}
            {f.rekomendasi && (
              <div>
                <p className={`text-[11px] font-semibold ${isSaran ? 'text-amber-600' : 'text-emerald-600'}`}>Rekomendasi</p>
                <p className="text-xs text-gray-700 leading-relaxed">{f.rekomendasi}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Input untuk tipe jawaban Teks ────────────────────────── */
function TextAnswerInput({ componentId, componentCode, componentName, submissionId, answers, onAnswerChange, disabled }) {
  const data = answers || {}

  function handleTextChange(e) {
    onAnswerChange?.({ ...data, text_answer: e.target.value })
  }

  function handleUploaded(path, name) {
    onAnswerChange?.({ ...data, file_path: path, file_name: name })
  }

  function handleDeleted() {
    onAnswerChange?.({ ...data, file_path: null, file_name: null })
  }

  const filePath = `${submissionId}/${componentId}/text_evidence`
  const filled = !!data.text_answer && !!data.file_path

  return (
    <div className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100 bg-gray-50">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-bold text-violet-700 uppercase tracking-wide">
              {componentCode}
            </span>
            <h4 className="text-sm font-semibold text-gray-900 truncate">{componentName}</h4>
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 shrink-0">
              Teks
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <span className={`text-sm font-bold ${filled ? 'text-green-600' : 'text-gray-400'}`}>
            {filled ? '✓ Terisi' : 'Belum lengkap'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Jawaban Teks *</label>
          <textarea
            value={data.text_answer || ''}
            onChange={handleTextChange}
            disabled={disabled}
            rows={3}
            placeholder="Tuliskan jawaban Anda di sini..."
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Dokumen Bukti PDF *</label>
          <FileUpload
            bucket="evidence-files"
            storagePath={filePath}
            existingPath={data.file_path || null}
            existingName={data.file_name}
            onUploaded={handleUploaded}
            onDeleted={handleDeleted}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}

export default function EvaluationForm() {
  const { unitInstrumentId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [unitInstrument, setUnitInstrument] = useState(null)
  const [instrument, setInstrument] = useState(null)
  const [components, setComponents] = useState([])
  const [submission, setSubmission] = useState(null)
  const [answers, setAnswers] = useState({}) // { [component_id]: ppepp_data }
  const [findingsList, setFindingsList] = useState([])  // array of audit_findings from all auditors
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  // ── Resize split pane ────────────────────────────────────
  const [leftWidth, setLeftWidth] = useState(42) // percent
  const isDragging = useRef(false)
  const containerRef = useRef(null)
  const startX = useRef(0)
  const startW = useRef(0)

  function startDrag(e) {
    isDragging.current = true
    startX.current = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX
    startW.current = leftWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMove(ev) {
      if (!isDragging.current) return
      const clientX = ev.type === 'touchmove' ? ev.touches[0].clientX : ev.clientX
      const dx = clientX - startX.current
      const containerW = containerRef.current?.offsetWidth || 1
      const newPct = Math.min(70, Math.max(20, startW.current + (dx / containerW) * 100))
      setLeftWidth(newPct)
    }
    function stopDrag() {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', stopDrag)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', stopDrag)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', stopDrag)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', stopDrag)
  }

  useEffect(() => { loadData() }, [unitInstrumentId])

  async function loadData() {
    setLoading(true)
    try {
      // 1. Get unit_instrument with cycle and instrument info
      const { data: ui, error: uiErr } = await supabase
        .from('unit_instruments')
        .select(`
          id, cycle_id, unit_id, instrument_id,
          audit_cycles ( id, name, academic_year, semester ),
          instruments ( id, code, name, pdf_storage_path ),
          units ( name )
        `)
        .eq('id', unitInstrumentId)
        .single()

      if (uiErr) throw uiErr
      setUnitInstrument(ui)
      setInstrument(ui.instruments)

      // 2. Get instrument components
      const { data: comps } = await supabase
        .from('instrument_components')
        .select('*')
        .eq('instrument_id', ui.instrument_id)
        .order('sort_order')
      setComponents(comps || [])

      // 3. Get or create submission
      const { data: existingSubs } = await supabase
        .from('submissions')
        .select('*')
        .eq('unit_instrument_id', unitInstrumentId)
        .limit(1)

      if (existingSubs?.length > 0) {
        const sub = existingSubs[0]
        setSubmission(sub)
        setAnswers(sub.answers || {})

        // Load ALL audit findings (multi-auditor)
        if (['submitted', 'under_review', 'revision_needed', 'verified', 'closed'].includes(sub.status)) {
          const { data: allFindings } = await supabase
            .from('audit_findings')
            .select('id, auditor_id, rubric_results, summary, category, profiles:auditor_id(full_name, email)')
            .eq('submission_id', sub.id)
          setFindingsList(
            (allFindings || []).map(f => ({
              ...f,
              auditor_name: f.profiles?.full_name || f.profiles?.email || 'Auditor',
              // Mark as 'saran' if submission was revision_needed when this finding was created
              _type: sub.status === 'revision_needed' ? 'saran' : 'temuan',
            }))
          )
        }
      } else {
        // Create draft submission
        const { data: newSub, error: createErr } = await supabase
          .from('submissions')
          .insert({ unit_instrument_id: unitInstrumentId, submitted_by: user.id })
          .select()
          .single()
        if (createErr) throw createErr
        setSubmission(newSub)
        setAnswers({})
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleAnswerChange(componentId, newPpepp) {
    setAnswers(prev => ({ ...prev, [componentId]: newPpepp }))
    setSaved(false)
  }

  const handleSaveDraft = useCallback(async () => {
    if (!submission) return
    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ answers, updated_at: new Date().toISOString() })
        .eq('id', submission.id)
      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }, [submission, answers])

  async function handleSubmit() {
    if (!submission) return
    // Validate: each component must have at least some data filled
    const incomplete = components.filter(c => {
      const score = computeComponentScore(c, answers[c.id])
      return score === 0
    })
    if (incomplete.length > 0) {
      const textCount = incomplete.filter(c => (c.rubric_schema?.answer_type || 'ppepp') === 'text').length
      const ppeppCount = incomplete.length - textCount
      const msgs = []
      if (ppeppCount > 0) msgs.push(`${ppeppCount} butir PPEPP belum ada bukti yang diunggah`)
      if (textCount > 0) msgs.push(`${textCount} butir Teks belum diisi jawaban/bukti`)
      setError(msgs.join('. ') + '.')
      return
    }

    if (!confirm('Kirim evaluasi diri ke auditor? Setelah dikirim, Anda tidak dapat mengubah jawaban kecuali ada permintaan revisi.')) return

    setSubmitting(true)
    setError(null)
    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          answers,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', submission.id)
      if (error) throw error
      setSubmission(s => ({ ...s, status: 'submitted' }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Compute overall scores (supports both ppepp and text types)
  const totalMaxScore = components.length * 5
  const totalScore = components.reduce((sum, c) => sum + computeComponentScore(c, answers[c.id]), 0)
  const pct = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0

  const isLocked = submission?.status === 'submitted' || submission?.status === 'verified' || submission?.status === 'closed'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error && !submission) {
    return (
      <div className="max-w-xl mx-auto rounded-md border border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="-m-6 flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/self-evaluation')}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-bold text-gray-900 truncate">{instrument?.name}</h1>
              <StatusBadge status={submission?.status ?? 'draft'} />
            </div>
            <p className="text-xs text-gray-400">
              {unitInstrument?.audit_cycles?.name} · {unitInstrument?.units?.name}
            </p>
          </div>
        </div>

        {/* Score summary */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-gray-400" />
            <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-bold text-gray-700 tabular-nums">{totalScore}/{totalMaxScore}</span>
          </div>

          {!isLocked && (
            <div className="flex items-center gap-2">
              {saved && <span className="text-xs text-green-600 font-medium">✓ Tersimpan</span>}
              {error && <span className="text-xs text-red-600 truncate max-w-[200px]">{error}</span>}
              <button onClick={handleSaveDraft} disabled={saving || submitting}
                className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? 'Menyimpan...' : 'Simpan Draf'}
              </button>
              <button onClick={handleSubmit} disabled={saving || submitting}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors">
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {submitting ? 'Mengirim...' : 'Kirim ke Auditor'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main split layout ────────────────────────────────── */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Left — PDF Viewer */}
        <div className="border-r border-gray-200 bg-gray-100 flex flex-col shrink-0 overflow-hidden"
          style={{ width: `${leftWidth}%` }}>
          <div className="px-4 py-2 border-b border-gray-200 bg-white">
            <p className="text-xs font-medium text-gray-500">📄 Dokumen Instrumen</p>
          </div>
          <div className="flex-1 overflow-hidden p-2">
            <PDFViewer
              storagePath={instrument?.pdf_storage_path}
              bucket="instrument-pdfs"
              height="100%"
            />
          </div>
        </div>

        {/* ── Drag Handle ── */}
        <div
          onMouseDown={startDrag}
          onTouchStart={startDrag}
          className="w-[6px] shrink-0 cursor-col-resize bg-gray-200 hover:bg-blue-400 active:bg-blue-500 transition-colors flex items-center justify-center group"
          title="Seret untuk mengubah ukuran"
        >
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-white" />
            ))}
          </div>
        </div>

        {/* Right — PPEPP Form */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-4">
            {/* Locked notice */}
            {isLocked && (
              <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />
                <p className="text-sm text-blue-700">
                  Evaluasi ini sudah dikirimkan dan tidak dapat diubah.
                  {submission?.status === 'revision_needed' && ' Auditor meminta revisi — Anda dapat mengedit kembali.'}
                </p>
              </div>
            )}

            {/* Components */}
            {components.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-300 p-8 text-center">
                <p className="text-sm text-gray-400">Butir penilaian belum dikonfigurasi oleh Super Admin.</p>
              </div>
            ) : (
              components.map(comp => {
                const answerType = comp.rubric_schema?.answer_type || 'ppepp'
                return (
                  <div key={comp.id}>
                    {answerType === 'text' ? (
                      <TextAnswerInput
                        componentId={comp.id}
                        componentCode={comp.code}
                        componentName={comp.name}
                        submissionId={submission?.id}
                        answers={answers[comp.id]}
                        onAnswerChange={newData => handleAnswerChange(comp.id, newData)}
                        disabled={isLocked && submission?.status !== 'revision_needed'}
                      />
                    ) : (
                      <PPEPPChecklist
                        componentId={comp.id}
                        componentCode={comp.code}
                        componentName={comp.name}
                        rubricSchema={comp.rubric_schema}
                        submissionId={submission?.id}
                        answers={answers[comp.id]}
                        onAnswerChange={newPpepp => handleAnswerChange(comp.id, newPpepp)}
                        disabled={isLocked && submission?.status !== 'revision_needed'}
                      />
                    )}
                    {/* Hasil desk evaluasi dari semua auditor per komponen */}
                    <FindingsPerAuditor
                      compId={comp.id}
                      findingsList={findingsList}
                    />
                  </div>
                )
              })
            )}

            {/* Bottom action (mobile-friendly) */}
            {!isLocked && components.length > 0 && (
              <div className="flex justify-end gap-3 pt-2 pb-6">
                <button onClick={handleSaveDraft} disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors">
                  <Save className="h-4 w-4" /> Simpan Draf
                </button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors">
                  <Send className="h-4 w-4" /> Kirim ke Auditor
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
