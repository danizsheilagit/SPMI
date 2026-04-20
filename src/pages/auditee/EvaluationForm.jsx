/**
 * Auditee — Form Evaluasi Diri PPEPP
 *
 * Layout split:
 *   Kiri (40%) : PDF instrumen (iframe Supabase Storage)
 *   Kanan (60%): Form PPEPP per butir penilaian (scrollable)
 *
 * Scoring: kumulatif sequential (0–5 per butir)
 * Bukti: wajib upload per tahap PPEPP yang terpenuhi
 */
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, Send, AlertCircle, Loader2, ChevronLeft, BarChart2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import PDFViewer from '../../components/PDFViewer'
import PPEPPChecklist, { computePPEPPScore } from '../../components/PPEPPChecklist'
import StatusBadge from '../../components/StatusBadge'

export default function EvaluationForm() {
  const { unitInstrumentId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [unitInstrument, setUnitInstrument] = useState(null)
  const [instrument, setInstrument] = useState(null)
  const [components, setComponents] = useState([])
  const [submission, setSubmission] = useState(null)
  const [answers, setAnswers] = useState({}) // { [component_id]: ppepp_data }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

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
        setSubmission(existingSubs[0])
        setAnswers(existingSubs[0].answers || {})
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
    // Validate: at least 1 stage completed per component
    const incomplete = components.filter(c => {
      const score = computePPEPPScore(answers[c.id])
      return score === 0
    })
    if (incomplete.length > 0) {
      setError(`${incomplete.length} butir belum ada bukti yang diunggah. Minimal unggah bukti Penetapan.`)
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

  // Compute overall scores
  const totalMaxScore = components.length * 5
  const totalScore = components.reduce((sum, c) => sum + computePPEPPScore(answers[c.id]), 0)
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
      <div className="flex flex-1 overflow-hidden">
        {/* Left — PDF Viewer */}
        <div className="w-[42%] border-r border-gray-200 bg-gray-100 flex flex-col shrink-0">
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
              components.map(comp => (
                <PPEPPChecklist
                  key={comp.id}
                  componentId={comp.id}
                  componentCode={comp.code}
                  componentName={comp.name}
                  rubricSchema={comp.rubric_schema}
                  submissionId={submission?.id}
                  answers={answers[comp.id]}
                  onAnswerChange={newPpepp => handleAnswerChange(comp.id, newPpepp)}
                  disabled={isLocked && submission?.status !== 'revision_needed'}
                />
              ))
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
