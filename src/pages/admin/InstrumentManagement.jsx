/**
 * Admin — Manajemen Instrumen (Upgraded)
 * CRUD Instrumen + Butir Penilaian + CSV Import/Export
 */
import { useEffect, useState } from 'react'
import {
  Upload, Plus, Trash2, FileText, ChevronDown, ChevronUp,
  Loader2, Eye, X, ExternalLink, Edit2, Download, UploadCloud,
  CheckCircle2, AlertCircle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { SkeletonGrid } from '../../components/UI/Skeleton'

import InstrumentModal from './instruments/InstrumentModal'
import ComponentModal from './instruments/ComponentModal'
import ImportPreviewModal from './instruments/ImportPreviewModal'
import { downloadCsvTemplate, parseCsv } from './instruments/csvUtils'

export default function InstrumentManagement() {
  const { user, role } = useAuth()
  const isAdmin = role === 'super_admin'

  const [instruments, setInstruments] = useState([])
  const [components, setComponents] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState(null)

  // Toast
  const [toast, setToast] = useState(null)

  // Instrument CRUD modal
  const [showInstModal, setShowInstModal] = useState(false)
  const [editInst, setEditInst] = useState(null)

  // Component CRUD modal
  const [showCompModal, setShowCompModal] = useState(false)
  const [editComp, setEditComp] = useState(null)
  const [compInstrument, setCompInstrument] = useState(null)

  // Import CSV
  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState([])
  const [importInst, setImportInst] = useState(null)
  const [importing, setImporting] = useState(false)

  // PDF Viewer
  const [viewingPdf, setViewingPdf] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [loadingPdf, setLoadingPdf] = useState(false)

  useEffect(() => { fetchInstruments() }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Fetch ─────────────────────────────────────────────
  async function fetchInstruments() {
    setLoading(true)
    const { data } = await supabase.from('instruments').select('*').order('code')
    setInstruments(data || [])
    setLoading(false)
  }

  async function fetchComponents(instrumentId) {
    const { data } = await supabase
      .from('instrument_components').select('*')
      .eq('instrument_id', instrumentId).order('sort_order')
    setComponents(prev => ({ ...prev, [instrumentId]: data || [] }))
    return data || []
  }

  async function toggleExpand(id) {
    if (expanded === id) { setExpanded(null) } else {
      setExpanded(id)
      if (!components[id]) await fetchComponents(id)
    }
  }

  // ── Instrument CRUD ───────────────────────────────────
  function openCreateInst() { setEditInst(null); setShowInstModal(true) }
  function openEditInst(inst) { setEditInst(inst); setShowInstModal(true) }

  async function handleSaveInst(form, editItem) {
    if (editItem) {
      const { error } = await supabase.from('instruments')
        .update({ code: form.code, name: form.name, description: form.description, is_active: form.is_active })
        .eq('id', editItem.id)
      if (error) throw error
      showToast('Instrumen berhasil diperbarui')
    } else {
      const { error } = await supabase.from('instruments').insert({
        code: form.code, name: form.name, description: form.description, is_active: form.is_active,
      })
      if (error) throw error
      showToast('Instrumen berhasil ditambahkan')
    }
    fetchInstruments()
  }

  // ── Component CRUD ────────────────────────────────────
  function openCreateComp(inst) {
    setCompInstrument(inst); setEditComp(null); setShowCompModal(true)
  }
  function openEditComp(comp, inst) {
    setCompInstrument(inst); setEditComp(comp); setShowCompModal(true)
  }

  async function handleSaveComp(form, editItem) {
    const rubric = {
      section: form.section,
      bukti_dokumen: form.bukti_dokumen,
      ppepp: {
        penetapan: { deskripsi: 'Dokumen penetapan/standar telah ditetapkan' },
        pelaksanaan: { deskripsi: 'Terdapat bukti pelaksanaan' },
        evaluasi: { deskripsi: 'Terdapat bukti evaluasi' },
        pengendalian: { deskripsi: 'Terdapat mekanisme pengendalian' },
        peningkatan: { deskripsi: 'Terdapat bukti peningkatan' },
      },
      max_score: 5,
    }
    const payload = {
      code: form.code, name: form.name, description: form.description,
      sort_order: form.sort_order, rubric_schema: rubric,
    }

    if (editItem) {
      const { error } = await supabase.from('instrument_components').update(payload).eq('id', editItem.id)
      if (error) throw error
      showToast('Butir penilaian diperbarui')
    } else {
      const { error } = await supabase.from('instrument_components').insert({
        ...payload, instrument_id: compInstrument.id,
      })
      if (error) throw error
      showToast('Butir penilaian ditambahkan')
    }
    await fetchComponents(compInstrument.id)
  }

  async function handleDeleteComp(compId, instrumentId) {
    if (!confirm('Hapus butir ini?')) return
    await supabase.from('instrument_components').delete().eq('id', compId)
    await fetchComponents(instrumentId)
    showToast('Butir dihapus')
  }

  // ── CSV Import ────────────────────────────────────────
  function handleCsvFile(file, inst) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const { rows, error } = parseCsv(e.target.result)
      if (error) { showToast(error, 'error'); return }
      setImportRows(rows); setImportInst(inst); setShowImport(true)
    }
    reader.readAsText(file)
  }

  async function handleConfirmImport() {
    setImporting(true)
    try {
      const inserts = importRows.map(r => ({
        instrument_id: importInst.id,
        code: r.code, name: r.name, sort_order: r.sort_order,
        description: '',
        rubric_schema: {
          section: r.section, bukti_dokumen: r.bukti_dokumen,
          ppepp: {
            penetapan: { deskripsi: 'Dokumen penetapan/standar telah ditetapkan' },
            pelaksanaan: { deskripsi: 'Terdapat bukti pelaksanaan' },
            evaluasi: { deskripsi: 'Terdapat bukti evaluasi' },
            pengendalian: { deskripsi: 'Terdapat mekanisme pengendalian' },
            peningkatan: { deskripsi: 'Terdapat bukti peningkatan' },
          },
          max_score: 5,
        },
      }))
      const { error } = await supabase.from('instrument_components').insert(inserts)
      if (error) throw error
      showToast(`${inserts.length} butir berhasil diimpor`)
      setShowImport(false)
      await fetchComponents(importInst.id)
    } catch (err) {
      showToast('Import gagal: ' + err.message, 'error')
    } finally {
      setImporting(false)
    }
  }

  // ── PDF ───────────────────────────────────────────────
  async function handlePDFUpload(instrument, file) {
    if (!file) return
    setUploadingId(instrument.id)
    try {
      const path = `${instrument.id}/${instrument.code}.pdf`
      const { error: upErr } = await supabase.storage
        .from('instrument-pdfs').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      await supabase.from('instruments').update({
        pdf_storage_path: path, pdf_uploaded_at: new Date().toISOString(), pdf_uploaded_by: user.id,
      }).eq('id', instrument.id)
      fetchInstruments()
      showToast('PDF berhasil diunggah')
    } catch (err) {
      showToast('Upload gagal: ' + err.message, 'error')
    } finally {
      setUploadingId(null)
    }
  }

  async function handleViewPdf(inst) {
    setViewingPdf(inst); setPdfUrl(null); setLoadingPdf(true)
    try {
      const { data, error } = await supabase.storage
        .from('instrument-pdfs').createSignedUrl(inst.pdf_storage_path, 3600)
      if (!error && data?.signedUrl) { setPdfUrl(data.signedUrl) } else {
        const { data: pub } = supabase.storage.from('instrument-pdfs').getPublicUrl(inst.pdf_storage_path)
        setPdfUrl(pub?.publicUrl)
      }
    } catch (err) { console.error(err) }
    finally { setLoadingPdf(false) }
  }

  // ── Helpers ───────────────────────────────────────────
  function getSections(instrumentId) {
    return [...new Set((components[instrumentId] || [])
      .map(c => c.rubric_schema?.section).filter(Boolean))]
  }

  function groupBySection(comps) {
    const groups = {}
    comps.forEach(c => {
      const sec = c.rubric_schema?.section || ''
      if (!groups[sec]) groups[sec] = []
      groups[sec].push(c)
    })
    return groups
  }

  // ── Render ────────────────────────────────────────────
  if (loading) return <SkeletonGrid cols={1} rows={4} />

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Manajemen Instrumen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Upload PDF instrumen dan kelola butir penilaian PPEPP</p>
        </div>
        {isAdmin && (
          <button onClick={openCreateInst}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Tambah Instrumen
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm ${
          toast.type === 'error'
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          {toast.type === 'error'
            ? <AlertCircle className="h-4 w-4 shrink-0" />
            : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Instrument List */}
      <div className="space-y-3">
        {instruments.map(inst => {
          const isExpanded = expanded === inst.id
          const comps = components[inst.id] || []
          const grouped = groupBySection(comps)

          return (
            <div key={inst.id} className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
                  {inst.code.replace('INST-', '')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{inst.name}</p>
                    {inst.is_active === false && (
                      <span className="rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                        Nonaktif
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{inst.code}{inst.description ? ` — ${inst.description}` : ''}</p>
                </div>

                <div className="flex items-center gap-2">
                  {/* PDF badge */}
                  {inst.pdf_storage_path ? (
                    <button onClick={() => handleViewPdf(inst)}
                      className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 rounded px-2.5 py-1 hover:bg-green-100 transition-colors">
                      <Eye className="h-3.5 w-3.5" /> PDF
                    </button>
                  ) : (
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2.5 py-1">
                      No PDF
                    </span>
                  )}

                  {/* Admin buttons */}
                  {isAdmin && (
                    <>
                      <label className={`inline-flex items-center gap-1 cursor-pointer rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                        uploadingId === inst.id ? 'border-gray-200 text-gray-400' : 'border-blue-200 text-blue-700 hover:bg-blue-50'
                      }`}>
                        {uploadingId === inst.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Upload className="h-3 w-3" />}
                        PDF
                        <input type="file" accept="application/pdf" className="hidden"
                          disabled={uploadingId === inst.id}
                          onChange={e => handlePDFUpload(inst, e.target.files?.[0])} />
                      </label>
                      <button onClick={() => openEditInst(inst)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit instrumen">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}

                  <button onClick={() => toggleExpand(inst.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded: components grouped by section */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {comps.length > 0 ? (
                    <div>
                      {Object.entries(grouped).map(([sec, items]) => (
                        <div key={sec}>
                          {sec && (
                            <div className="px-5 py-2 bg-blue-50/60 border-b border-blue-100">
                              <p className="text-xs font-semibold text-blue-700">{sec}</p>
                            </div>
                          )}
                          <div className="divide-y divide-gray-50">
                            {items.map(comp => (
                              <div key={comp.id} className="flex items-start gap-3 px-5 py-3 bg-gray-50/60 group">
                                <span className="rounded bg-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-600 mt-0.5 shrink-0">
                                  {comp.code}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-800">{comp.name}</p>
                                  {comp.rubric_schema?.bukti_dokumen && (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      📄 {comp.rubric_schema.bukti_dokumen}
                                    </p>
                                  )}
                                </div>
                                {isAdmin && (
                                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditComp(comp, inst)}
                                      className="p-1 text-gray-300 hover:text-blue-500 rounded transition-colors">
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => handleDeleteComp(comp.id, inst.id)}
                                      className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-6 text-center text-sm text-gray-400">
                      Belum ada butir penilaian untuk instrumen ini.
                    </div>
                  )}

                  {/* Footer actions */}
                  {isAdmin && (
                    <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                      <button onClick={() => openCreateComp(inst)}
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                        <Plus className="h-3.5 w-3.5" /> Tambah Butir
                      </button>
                      <span className="text-gray-200">|</span>
                      <button onClick={() => downloadCsvTemplate(inst, comps)}
                        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium">
                        <Download className="h-3.5 w-3.5" /> Template CSV
                      </button>
                      <label className="inline-flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium cursor-pointer">
                        <UploadCloud className="h-3.5 w-3.5" /> Import CSV
                        <input type="file" accept=".csv" className="hidden"
                          onChange={e => { handleCsvFile(e.target.files?.[0], inst); e.target.value = '' }} />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Modals ──────────────────────────────────────── */}
      <InstrumentModal
        open={showInstModal} editItem={editInst}
        onSave={handleSaveInst} onClose={() => setShowInstModal(false)}
      />
      <ComponentModal
        open={showCompModal} editItem={editComp}
        instrumentName={compInstrument?.name}
        existingSections={compInstrument ? getSections(compInstrument.id) : []}
        onSave={handleSaveComp} onClose={() => setShowCompModal(false)}
      />
      <ImportPreviewModal
        open={showImport} rows={importRows}
        instrumentName={importInst?.name} importing={importing}
        onConfirm={handleConfirmImport} onClose={() => setShowImport(false)}
      />

      {/* ── PDF Viewer ──────────────────────────────────── */}
      {viewingPdf && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
          <div className="flex items-center justify-between bg-gray-900 px-5 py-3 shrink-0">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-green-400" />
              <div>
                <p className="text-sm font-semibold text-white">{viewingPdf.name}</p>
                <p className="text-xs text-gray-400">{viewingPdf.code}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded border border-gray-600 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:border-gray-400 transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" /> Tab Baru
                </a>
              )}
              <button onClick={() => { setViewingPdf(null); setPdfUrl(null) }}
                className="rounded border border-gray-600 p-1.5 text-gray-300 hover:text-white hover:border-gray-400 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 relative bg-gray-800">
            {loadingPdf ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400">
                <Loader2 className="h-8 w-8 animate-spin" /><p className="text-sm">Memuat PDF...</p>
              </div>
            ) : pdfUrl ? (
              <iframe src={pdfUrl} title={viewingPdf.name} className="w-full h-full border-0" allow="fullscreen" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400">
                <FileText className="h-10 w-10 opacity-30" /><p className="text-sm">Gagal memuat PDF.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
