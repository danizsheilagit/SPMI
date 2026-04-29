/**
 * Admin — Manajemen Instrumen
 * Upload PDF per instrumen + kelola butir penilaian (instrument_components).
 */
import { useEffect, useState } from 'react'
import { Upload, Plus, Trash2, FileText, ChevronDown, ChevronUp, Loader2, Eye, X, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { SkeletonGrid } from '../../components/UI/Skeleton'

export default function InstrumentManagement() {
  const { user, role } = useAuth()
  const isAdmin = role === 'super_admin'
  const [instruments, setInstruments] = useState([])
  const [components, setComponents] = useState({}) // { instrument_id: [...] }
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState(null)
  const [addingComp, setAddingComp] = useState(null) // instrument_id
  const [compForm, setCompForm] = useState({ code: '', name: '', description: '', sort_order: 0 })
  const [savingComp, setSavingComp] = useState(false)

  // PDF Viewer
  const [viewingPdf, setViewingPdf] = useState(null) // { name, path }
  const [pdfUrl, setPdfUrl]         = useState(null)
  const [loadingPdf, setLoadingPdf] = useState(false)

  useEffect(() => { fetchInstruments() }, [])

  async function fetchInstruments() {
    setLoading(true)
    const { data } = await supabase.from('instruments').select('*').order('code')
    setInstruments(data || [])
    setLoading(false)
  }

  async function fetchComponents(instrumentId) {
    const { data } = await supabase
      .from('instrument_components')
      .select('*')
      .eq('instrument_id', instrumentId)
      .order('sort_order')
    setComponents(prev => ({ ...prev, [instrumentId]: data || [] }))
  }

  async function toggleExpand(id) {
    if (expanded === id) {
      setExpanded(null)
    } else {
      setExpanded(id)
      if (!components[id]) await fetchComponents(id)
    }
  }

  async function handlePDFUpload(instrument, file) {
    if (!file) return
    setUploadingId(instrument.id)
    try {
      const path = `${instrument.id}/${instrument.code}.pdf`
      const { error: uploadErr } = await supabase.storage
        .from('instrument-pdfs')
        .upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr

      await supabase.from('instruments').update({
        pdf_storage_path: path,
        pdf_uploaded_at: new Date().toISOString(),
        pdf_uploaded_by: user.id,
      }).eq('id', instrument.id)

      fetchInstruments()
    } catch (err) {
      alert('Upload gagal: ' + err.message)
    } finally {
      setUploadingId(null)
    }
  }

  async function handleAddComponent(instrumentId) {
    setSavingComp(true)
    try {
      const existingCount = (components[instrumentId] || []).length
      const { error } = await supabase.from('instrument_components').insert({
        instrument_id: instrumentId,
        code: compForm.code,
        name: compForm.name,
        description: compForm.description,
        sort_order: compForm.sort_order || existingCount + 1,
        rubric_schema: {
          ppepp: {
            penetapan:    { deskripsi: 'Dokumen penetapan/standar telah ditetapkan' },
            pelaksanaan:  { deskripsi: 'Terdapat bukti pelaksanaan' },
            evaluasi:     { deskripsi: 'Terdapat bukti evaluasi' },
            pengendalian: { deskripsi: 'Terdapat mekanisme pengendalian' },
            peningkatan:  { deskripsi: 'Terdapat bukti peningkatan' },
          },
          max_score: 5,
        },
      })
      if (error) throw error
      setAddingComp(null)
      setCompForm({ code: '', name: '', description: '', sort_order: 0 })
      await fetchComponents(instrumentId)
    } catch (err) {
      alert('Gagal: ' + err.message)
    } finally {
      setSavingComp(false)
    }
  }

  async function handleDeleteComponent(compId, instrumentId) {
    if (!confirm('Hapus butir ini? Data evaluasi yang sudah ada tidak akan terpengaruh.')) return
    await supabase.from('instrument_components').delete().eq('id', compId)
    await fetchComponents(instrumentId)
  }

  async function handleViewPdf(inst) {
    setViewingPdf(inst)
    setPdfUrl(null)
    setLoadingPdf(true)
    try {
      // Coba signed URL dulu (untuk bucket private)
      const { data, error } = await supabase.storage
        .from('instrument-pdfs')
        .createSignedUrl(inst.pdf_storage_path, 3600)
      if (!error && data?.signedUrl) {
        setPdfUrl(data.signedUrl)
      } else {
        // Fallback: public URL
        const { data: pub } = supabase.storage
          .from('instrument-pdfs')
          .getPublicUrl(inst.pdf_storage_path)
        setPdfUrl(pub?.publicUrl)
      }
    } catch (err) {
      console.error('PDF URL error:', err)
    } finally {
      setLoadingPdf(false)
    }
  }

  function closePdfViewer() {
    setViewingPdf(null)
    setPdfUrl(null)
  }

  if (loading) return <SkeletonGrid cols={1} rows={4} />

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Manajemen Instrumen</h1>
        <p className="text-sm text-gray-500 mt-0.5">Upload PDF instrumen dan kelola butir penilaian PPEPP</p>
      </div>

      <div className="space-y-3">
        {instruments.map(inst => {
          const isExpanded = expanded === inst.id
          const comps = components[inst.id] || []

          return (
            <div key={inst.id} className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/* Instrument header row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
                  {inst.code.replace('INST-', '')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{inst.name}</p>
                  <p className="text-xs text-gray-400">{inst.code}</p>
                </div>

                {/* PDF status & upload */}
                <div className="flex items-center gap-3">
                  {inst.pdf_storage_path ? (
                    <button
                      onClick={() => handleViewPdf(inst)}
                      className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 rounded px-2.5 py-1 hover:bg-green-100 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" /> PDF Tersedia
                    </button>
                  ) : (
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2.5 py-1">
                      PDF Belum Diunggah
                    </span>
                  )}

                  {/* Upload PDF — hanya admin */}
                  {isAdmin && (
                    <label className={`inline-flex items-center gap-1.5 cursor-pointer rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                      uploadingId === inst.id ? 'border-gray-200 text-gray-400' : 'border-blue-200 text-blue-700 hover:bg-blue-50'
                    }`}>
                      {uploadingId === inst.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      {inst.pdf_storage_path ? 'Ganti PDF' : 'Upload PDF'}
                      <input
                        type="file" accept="application/pdf" className="hidden"
                        disabled={uploadingId === inst.id}
                        onChange={e => handlePDFUpload(inst, e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>

                <button onClick={() => toggleExpand(inst.id)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {/* Components list */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {comps.length > 0 && (
                    <div className="divide-y divide-gray-50">
                      {comps.map(comp => (
                        <div key={comp.id} className="flex items-center gap-3 px-5 py-3 bg-gray-50/60">
                          <span className="rounded bg-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-600">{comp.code}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{comp.name}</p>
                            {comp.description && <p className="text-xs text-gray-400">{comp.description}</p>}
                          </div>
                          {isAdmin && (
                            <button onClick={() => handleDeleteComponent(comp.id, inst.id)}
                              className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tambah butir — hanya admin */}
                  {isAdmin && (addingComp === inst.id ? (
                    <div className="px-5 py-4 bg-blue-50/40 border-t border-blue-100">
                      <p className="text-xs font-semibold text-blue-700 mb-3">Tambah Butir Penilaian</p>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <input placeholder="Kode (cth: S1.B6)" value={compForm.code}
                          onChange={e => setCompForm(f => ({ ...f, code: e.target.value }))}
                          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <input placeholder="Nama Butir" value={compForm.name}
                          onChange={e => setCompForm(f => ({ ...f, name: e.target.value }))}
                          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <input placeholder="Deskripsi (opsional)" value={compForm.description}
                        onChange={e => setCompForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3" />
                      <div className="flex gap-2">
                        <button onClick={() => handleAddComponent(inst.id)} disabled={savingComp || !compForm.code || !compForm.name}
                          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          {savingComp ? 'Menyimpan...' : 'Simpan Butir'}
                        </button>
                        <button onClick={() => setAddingComp(null)}
                          className="rounded px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors">
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-5 py-3 border-t border-gray-100">
                      <button onClick={() => { setAddingComp(inst.id); setCompForm({ code: '', name: '', description: '', sort_order: comps.length + 1 }) }}
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                        <Plus className="h-3.5 w-3.5" /> Tambah Butir Penilaian
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── PDF Viewer Modal ────────────────────────────────────── */}
      {viewingPdf && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
          {/* Toolbar */}
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
                  <ExternalLink className="h-3.5 w-3.5" /> Buka di Tab Baru
                </a>
              )}
              <button onClick={closePdfViewer}
                className="rounded border border-gray-600 p-1.5 text-gray-300 hover:text-white hover:border-gray-400 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* iframe area */}
          <div className="flex-1 relative bg-gray-800">
            {loadingPdf ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Memuat PDF...</p>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                title={viewingPdf.name}
                className="w-full h-full border-0"
                allow="fullscreen"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400">
                <FileText className="h-10 w-10 opacity-30" />
                <p className="text-sm">Gagal memuat PDF. Coba buka di tab baru.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
