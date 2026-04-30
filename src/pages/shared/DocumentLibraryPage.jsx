/**
 * DocumentLibraryPage — Halaman Dokumen SPMI / Pendukung (Generik)
 * Digunakan untuk semua sub-menu Dokumen SPMI dan Dokumen Pendukung.
 * docType dikirim sebagai prop dari route, menentukan filter tabel spmi_documents.
 *
 * Persis seperti StandardManagement: card grid, upload PDF, view PDF (signed URL).
 * CRUD hanya untuk Super Admin dan Kepala LPMPP.
 */
import { useEffect, useState } from 'react'
import {
  Plus, Edit2, Trash2, Upload, Eye, X, Loader2,
  FileText, CheckCircle2, AlertCircle, Save, FolderOpen,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { SkeletonGrid } from '../../components/UI/Skeleton'

const BUCKET = 'dokumen-spmi'
const EMPTY_FORM = { code: '', name: '', description: '', sort_order: 0 }

/* ─── PDF Viewer fullscreen ─────────────────────────────────── */
function PdfModal({ url, title, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between bg-gray-900 px-5 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-300" />
          <span className="text-sm text-white font-medium truncate max-w-lg">{title}</span>
        </div>
        <button onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-white transition-colors rounded">
          <X className="h-5 w-5" />
        </button>
      </div>
      <iframe src={url} className="flex-1 w-full border-0" title={title} />
    </div>
  )
}

/* ─── Document Card ─────────────────────────────────────────── */
function DocCard({ doc, isAdmin, onEdit, onDelete, onUpload, onView, uploading }) {
  const hasPdf = !!doc.pdf_storage_path

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col group">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-indigo-50 shrink-0">
              <FolderOpen className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="min-w-0">
              {doc.code && (
                <span className="text-xs font-bold text-indigo-600 font-mono">{doc.code}</span>
              )}
              <p className="text-sm font-semibold text-gray-900 leading-snug mt-0.5 line-clamp-2">
                {doc.name}
              </p>
            </div>
          </div>
          {/* Admin actions */}
          {isAdmin && (
            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(doc)}
                className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Edit">
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onDelete(doc)}
                className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Hapus">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        {doc.description && (
          <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">{doc.description}</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap">
        {hasPdf ? (
          <button onClick={() => onView(doc)}
            className="inline-flex items-center gap-1.5 rounded border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors">
            <Eye className="h-3.5 w-3.5" /> Lihat PDF
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <FileText className="h-3.5 w-3.5" /> Belum ada PDF
          </span>
        )}

        {isAdmin && (
          <label className={`inline-flex items-center gap-1.5 cursor-pointer rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
            uploading === doc.id
              ? 'border-gray-200 text-gray-400'
              : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700'
          }`}>
            {uploading === doc.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Upload className="h-3.5 w-3.5" />}
            {hasPdf ? 'Ganti PDF' : 'Upload PDF'}
            <input type="file" accept="application/pdf" className="hidden"
              disabled={uploading === doc.id}
              onChange={e => onUpload(doc, e.target.files?.[0])} />
          </label>
        )}
      </div>
    </div>
  )
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function DocumentLibraryPage({ docType, title, description }) {
  const { role } = useAuth()
  const isAdmin = role === 'super_admin' || role === 'kepala_lpmpp'

  const [docs,       setDocs]       = useState([])
  const [loading,    setLoading]    = useState(true)

  // CRUD
  const [showModal,  setShowModal]  = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState(null)

  // Upload & view
  const [uploadingId, setUploadingId] = useState(null)
  const [viewingPdf,  setViewingPdf]  = useState(null)
  const [toast,       setToast]       = useState(null)

  // Refetch saat docType berubah (navigasi antar sub-menu)
  useEffect(() => { fetchDocs() }, [docType])

  async function fetchDocs() {
    setLoading(true)
    setDocs([])
    const { data, error } = await supabase
      .from('spmi_documents')
      .select('*')
      .eq('doc_type', docType)
      .eq('is_active', true)
      .order('sort_order')
      .order('name')
    if (!error) setDocs(data || [])
    setLoading(false)
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function openCreate() {
    setEditItem(null)
    setForm({ ...EMPTY_FORM, sort_order: docs.length + 1 })
    setFormError(null)
    setShowModal(true)
  }

  function openEdit(doc) {
    setEditItem(doc)
    setForm({
      code:        doc.code || '',
      name:        doc.name,
      description: doc.description || '',
      sort_order:  doc.sort_order,
    })
    setFormError(null)
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        ...form,
        code: form.code.trim() || null,
        updated_at: new Date().toISOString(),
      }
      if (editItem) {
        const { error } = await supabase
          .from('spmi_documents').update(payload).eq('id', editItem.id)
        if (error) throw error
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase
          .from('spmi_documents')
          .insert({ ...payload, doc_type: docType, created_by: user.id })
        if (error) throw error
      }
      setShowModal(false)
      fetchDocs()
      showToast(editItem ? 'Dokumen berhasil diperbarui' : 'Dokumen berhasil ditambahkan')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(doc) {
    if (!confirm(`Hapus dokumen "${doc.name}"?`)) return
    await supabase.from('spmi_documents').update({ is_active: false }).eq('id', doc.id)
    fetchDocs()
    showToast('Dokumen dihapus')
  }

  async function handleUpload(doc, file) {
    if (!file) return
    setUploadingId(doc.id)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${docType}/${doc.id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { error: dbErr } = await supabase
        .from('spmi_documents')
        .update({ pdf_storage_path: path, updated_at: new Date().toISOString() })
        .eq('id', doc.id)
      if (dbErr) throw dbErr
      fetchDocs()
      showToast('PDF berhasil diunggah')
    } catch (err) {
      showToast('Gagal upload: ' + err.message, 'error')
    } finally {
      setUploadingId(null)
    }
  }

  async function handleView(doc) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(doc.pdf_storage_path, 3600)
      if (error) throw error
      setViewingPdf({ url: data.signedUrl, title: doc.name })
    } catch (err) {
      showToast('Gagal membuka PDF: ' + err.message, 'error')
    }
  }

  return (
    <div className="max-w-6xl space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
        {isAdmin && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Tambah Dokumen
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

      {/* Grid */}
      {loading ? (
        <SkeletonGrid cols={3} rows={2} />
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <FolderOpen className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">
            {isAdmin
              ? `Belum ada dokumen. Klik "+ Tambah Dokumen" untuk menambahkan.`
              : `Belum ada dokumen ${title}.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map(doc => (
            <DocCard
              key={doc.id}
              doc={doc}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={handleDelete}
              onUpload={handleUpload}
              onView={handleView}
              uploading={uploadingId}
            />
          ))}
        </div>
      )}

      {/* CRUD Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {editItem ? 'Edit Dokumen' : `Tambah ${title}`}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Kode/Nomor</label>
                  <input value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    placeholder="cth: KEB-01"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Urutan</label>
                  <input type="number" min={0} value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nama Dokumen *</label>
                <input required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={`cth: Kebijakan SPMI STIKOM Yos Sudarso`}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Deskripsi</label>
                <textarea value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Deskripsi singkat dokumen ini..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Menyimpan...' : editItem ? 'Simpan Perubahan' : 'Tambah Dokumen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      {viewingPdf && (
        <PdfModal url={viewingPdf.url} title={viewingPdf.title} onClose={() => setViewingPdf(null)} />
      )}
    </div>
  )
}
