/**
 * StandardManagement — Halaman Standar Mutu
 * Dokumen rujukan untuk penyusunan instrumen AMI.
 *
 * Akses:  Super Admin, Kepala LPMPP, Pimpinan, Auditor (is_auditor)
 * CRUD:   Super Admin only
 * PDF:    Upload & view (Super Admin upload, semua bisa view)
 */
import { useEffect, useState, useRef } from 'react'
import {
  Plus, Edit2, Trash2, Upload, Eye, X, Loader2,
  BookOpen, FileText, CheckCircle2, AlertCircle, Save,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { SkeletonGrid } from '../../components/UI/Skeleton'

/* ─── Kategori standar ───────────────────────────────────────── */
const CATEGORIES = ['Semua', 'Pendidikan', 'Penelitian', 'PKM', 'Umum', 'Lainnya']

const CATEGORY_COLORS = {
  Pendidikan: 'bg-blue-100   text-blue-700   border-blue-200',
  Penelitian: 'bg-violet-100 text-violet-700 border-violet-200',
  PKM:        'bg-green-100  text-green-700  border-green-200',
  Umum:       'bg-gray-100   text-gray-600   border-gray-200',
  Lainnya:    'bg-amber-100  text-amber-700  border-amber-200',
}

const EMPTY_FORM = { code: '', name: '', description: '', category: 'Umum', sort_order: 0 }

/* ─── PDF Viewer Modal ───────────────────────────────────────── */
function PdfModal({ url, title, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
      <div className="flex items-center justify-between bg-gray-900 px-5 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-300" />
          <span className="text-sm text-white font-medium truncate max-w-md">{title}</span>
        </div>
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white transition-colors rounded">
          <X className="h-5 w-5" />
        </button>
      </div>
      <iframe src={url} className="flex-1 w-full border-0" title={title} />
    </div>
  )
}

/* ─── Standard Card ──────────────────────────────────────────── */
function StandardCard({ std, isAdmin, onEdit, onDelete, onUpload, onView, uploading }) {
  const hasPdf = !!std.pdf_storage_path
  const catColor = CATEGORY_COLORS[std.category] || CATEGORY_COLORS['Umum']

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col group">
      {/* Card header */}
      <div className="px-5 pt-5 pb-3 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-indigo-50 shrink-0">
              <BookOpen className="h-4.5 w-4.5 text-indigo-600 h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-indigo-600 font-mono">{std.code}</span>
              <p className="text-sm font-semibold text-gray-900 leading-snug mt-0.5 line-clamp-2">
                {std.name}
              </p>
            </div>
          </div>
          {/* Admin actions */}
          {isAdmin && (
            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(std)}
                className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Edit">
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onDelete(std)}
                className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Hapus">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Category badge */}
        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${catColor}`}>
          {std.category}
        </span>

        {/* Description */}
        {std.description && (
          <p className="mt-2.5 text-xs text-gray-500 line-clamp-3 leading-relaxed">
            {std.description}
          </p>
        )}
      </div>

      {/* Card footer actions */}
      <div className="px-5 pb-4 pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap">
        {/* View PDF */}
        {hasPdf ? (
          <button onClick={() => onView(std)}
            className="inline-flex items-center gap-1.5 rounded border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors">
            <Eye className="h-3.5 w-3.5" /> Lihat PDF
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <FileText className="h-3.5 w-3.5" /> Belum ada PDF
          </span>
        )}

        {/* Upload PDF (admin only) */}
        {isAdmin && (
          <label className={`inline-flex items-center gap-1.5 cursor-pointer rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
            uploading === std.id
              ? 'border-gray-200 text-gray-400'
              : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700'
          }`}>
            {uploading === std.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Upload className="h-3.5 w-3.5" />}
            {hasPdf ? 'Ganti PDF' : 'Upload PDF'}
            <input type="file" accept="application/pdf" className="hidden"
              disabled={uploading === std.id}
              onChange={e => onUpload(std, e.target.files?.[0])} />
          </label>
        )}
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function StandardManagement() {
  const { role } = useAuth()
  const isAdmin = role === 'super_admin'

  const [standards,   setStandards]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [activeCategory, setActiveCategory] = useState('Semua')

  // CRUD modal
  const [showModal,  setShowModal]  = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState(null)

  // Upload & view
  const [uploadingId, setUploadingId] = useState(null)
  const [viewingPdf,  setViewingPdf]  = useState(null) // { url, title }
  const [toast,       setToast]       = useState(null)

  useEffect(() => { fetchStandards() }, [])

  async function fetchStandards() {
    setLoading(true)
    const { data, error } = await supabase
      .from('standards')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .order('code')
    if (!error) setStandards(data || [])
    setLoading(false)
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  /* ── Modal helpers ── */
  function openCreate() {
    setEditItem(null)
    setForm({ ...EMPTY_FORM, sort_order: standards.length + 1 })
    setFormError(null)
    setShowModal(true)
  }

  function openEdit(std) {
    setEditItem(std)
    setForm({
      code:        std.code,
      name:        std.name,
      description: std.description || '',
      category:    std.category,
      sort_order:  std.sort_order,
    })
    setFormError(null)
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      if (editItem) {
        const { error } = await supabase
          .from('standards')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', editItem.id)
        if (error) throw error
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('standards').insert({ ...form, created_by: user.id })
        if (error) throw error
      }
      setShowModal(false)
      fetchStandards()
      showToast(editItem ? 'Standar berhasil diperbarui' : 'Standar berhasil ditambahkan')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(std) {
    if (!confirm(`Hapus standar "${std.name}"?`)) return
    await supabase.from('standards').update({ is_active: false }).eq('id', std.id)
    fetchStandards()
    showToast('Standar dihapus')
  }

  /* ── PDF Upload ── */
  async function handleUpload(std, file) {
    if (!file) return
    setUploadingId(std.id)
    try {
      const ext  = file.name.split('.').pop()
      const path = `standards/${std.id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('standard-docs')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { error: dbErr } = await supabase
        .from('standards')
        .update({ pdf_storage_path: path, updated_at: new Date().toISOString() })
        .eq('id', std.id)
      if (dbErr) throw dbErr
      fetchStandards()
      showToast('PDF berhasil diunggah')
    } catch (err) {
      showToast('Gagal upload: ' + err.message, 'error')
    } finally {
      setUploadingId(null)
    }
  }

  /* ── PDF View (signed URL) ── */
  async function handleView(std) {
    try {
      const { data, error } = await supabase.storage
        .from('standard-docs')
        .createSignedUrl(std.pdf_storage_path, 3600)
      if (error) throw error
      setViewingPdf({ url: data.signedUrl, title: std.name })
    } catch (err) {
      showToast('Gagal membuka PDF: ' + err.message, 'error')
    }
  }

  /* ── Filtered list ── */
  const filtered = activeCategory === 'Semua'
    ? standards
    : standards.filter(s => s.category === activeCategory)

  const categoryCounts = CATEGORIES.slice(1).reduce((acc, cat) => {
    acc[cat] = standards.filter(s => s.category === cat).length
    return acc
  }, {})

  return (
    <div className="max-w-6xl space-y-6">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Standar Mutu</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Dokumen rujukan penyusunan instrumen Audit Mutu Internal
          </p>
        </div>
        {isAdmin && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Tambah Standar
          </button>
        )}
      </div>

      {/* ── Toast ───────────────────────────────────────────── */}
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

      {/* ── Stats & Category Tabs ────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => {
          const count = cat === 'Semua' ? standards.length : (categoryCounts[cat] || 0)
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700'
              }`}
            >
              {cat}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                activeCategory === cat ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Grid ────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonGrid cols={3} rows={2} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <BookOpen className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">
            {activeCategory === 'Semua'
              ? 'Belum ada standar. Klik "+ Tambah Standar" untuk menambahkan.'
              : `Belum ada standar untuk kategori "${activeCategory}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(std => (
            <StandardCard
              key={std.id}
              std={std}
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

      {/* ── CRUD Modal ──────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {editItem ? 'Edit Standar' : 'Tambah Standar Baru'}
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Kode *</label>
                  <input required value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="cth: SN-01"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Kategori *</label>
                  <select value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nama Standar *</label>
                <input required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="cth: SN-Dikti: Standar Kompetensi Lulusan"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Deskripsi</label>
                <textarea value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Deskripsi singkat standar ini..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Urutan Tampil</label>
                <input type="number" min={0} value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
                  {saving ? 'Menyimpan...' : editItem ? 'Simpan Perubahan' : 'Tambah Standar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PDF Viewer ───────────────────────────────────────── */}
      {viewingPdf && (
        <PdfModal
          url={viewingPdf.url}
          title={viewingPdf.title}
          onClose={() => setViewingPdf(null)}
        />
      )}
    </div>
  )
}
