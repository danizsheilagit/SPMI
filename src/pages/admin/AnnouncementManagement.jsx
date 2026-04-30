/**
 * Admin — Manajemen Pengumuman
 * Super Admin & Kepala LPMPP dapat membuat, mengedit, dan menghapus pengumuman.
 * Setiap pengumuman bisa disertai lampiran PDF yang diupload ke Supabase Storage.
 */
import { useEffect, useState } from 'react'
import {
  Plus, Megaphone, Loader2, X, Pencil, Trash2, AlertCircle,
  FileText, Upload, Eye, EyeOff, Calendar, Check,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const BUCKET = 'announcements'

export default function AnnouncementManagement() {
  const { user } = useAuth()
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Modal state
  const [showModal,  setShowModal]  = useState(false)
  const [editing,    setEditing]    = useState(null)   // null = create
  const [form,       setForm]       = useState({ title: '', content: '' })
  const [pdfFile,    setPdfFile]    = useState(null)
  const [pdfPreview, setPdfPreview] = useState(null)   // URL preview existing PDF
  const [saving,     setSaving]     = useState(false)
  const [uploading,  setUploading]  = useState(false)

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    setLoading(true)
    try {
      const { data, error: e } = await supabase
        .from('announcements')
        .select('*, profiles:created_by(full_name)')
        .order('created_at', { ascending: false })
      if (e) throw e
      setItems(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm({ title: '', content: '' })
    setPdfFile(null)
    setPdfPreview(null)
    setShowModal(true)
    setError(null)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({ title: item.title, content: item.content || '' })
    setPdfFile(null)
    setPdfPreview(item.pdf_url || null)
    setShowModal(true)
    setError(null)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setPdfFile(null)
    setPdfPreview(null)
    setError(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Judul wajib diisi'); return }
    setSaving(true)
    setError(null)
    try {
      let pdfUrl  = editing?.pdf_url  || null
      let pdfName = editing?.pdf_name || null

      // Upload PDF jika ada file baru
      if (pdfFile) {
        setUploading(true)
        const ext      = pdfFile.name.split('.').pop()
        const fileName = `${Date.now()}_${user.id}.${ext}`
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(fileName, pdfFile, { upsert: true, contentType: 'application/pdf' })
        if (upErr) throw upErr

        const { data: urlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(fileName)
        pdfUrl  = urlData.publicUrl
        pdfName = pdfFile.name
        setUploading(false)
      }

      const payload = {
        title:     form.title.trim(),
        content:   form.content.trim() || null,
        pdf_url:   pdfUrl,
        pdf_name:  pdfName,
        updated_at: new Date().toISOString(),
      }

      if (editing) {
        const { error: e } = await supabase
          .from('announcements').update(payload).eq('id', editing.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase
          .from('announcements')
          .insert({ ...payload, created_by: user.id, is_active: true })
        if (e) throw e
      }

      closeModal()
      loadItems()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  async function handleToggleActive(item) {
    try {
      await supabase
        .from('announcements')
        .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
        .eq('id', item.id)
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Hapus pengumuman "${item.title}"?`)) return
    try {
      // Hapus file dari storage jika ada
      if (item.pdf_url) {
        const path = item.pdf_url.split(`/${BUCKET}/`)[1]
        if (path) await supabase.storage.from(BUCKET).remove([path])
      }
      await supabase.from('announcements').delete().eq('id', item.id)
      setItems(prev => prev.filter(i => i.id !== item.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pengumuman</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kelola pengumuman dan undangan untuk Auditor &amp; Auditee
          </p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-sm">
          <Plus className="h-4 w-4" /> Buat Pengumuman
        </button>
      </div>

      {error && !showModal && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
          <span className="text-sm text-gray-500">Memuat pengumuman...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-12 text-center">
          <Megaphone className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Belum ada pengumuman. Klik "+ Buat Pengumuman" untuk memulai.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id}
              className={`rounded-md border bg-white shadow-sm transition-opacity ${item.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex items-start gap-4 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${item.is_active ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <Megaphone className={`h-5 w-5 ${item.is_active ? 'text-blue-600' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{item.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 ${
                      item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {item.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  {item.content && (
                    <p className="text-xs text-gray-600 line-clamp-2 mb-1">{item.content}</p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(item.published_at || item.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </span>
                    {item.profiles?.full_name && (
                      <span>oleh {item.profiles.full_name}</span>
                    )}
                    {item.pdf_url && (
                      <span className="flex items-center gap-1 text-blue-500">
                        <FileText className="h-3 w-3" />
                        {item.pdf_name || 'Lampiran PDF'}
                      </span>
                    )}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => handleToggleActive(item)}
                    title={item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    {item.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => openEdit(item)}
                    className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(item)}
                    className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Create/Edit ──────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {editing ? 'Edit Pengumuman' : 'Buat Pengumuman Baru'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Judul Pengumuman <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="cth: Undangan Rapat AMI 2026"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Isi Pengumuman
                </label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Tulis isi pengumuman di sini..."
                  rows={4}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Lampiran PDF (Undangan, dll.)
                </label>

                {/* Existing PDF preview */}
                {pdfPreview && !pdfFile && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 flex items-center justify-between mb-2">
                    <span className="text-xs text-blue-700 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      {editing?.pdf_name || 'Lampiran terlampir'}
                    </span>
                    <button type="button" onClick={() => setPdfPreview(null)}
                      className="text-xs text-red-500 hover:text-red-700">Hapus</button>
                  </div>
                )}

                {/* File input */}
                <label className={`flex items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-4 cursor-pointer transition-colors ${
                  pdfFile ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                }`}>
                  <input
                    type="file" accept="application/pdf"
                    onChange={e => setPdfFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  {pdfFile ? (
                    <span className="flex items-center gap-2 text-xs text-green-700">
                      <Check className="h-4 w-4" /> {pdfFile.name}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-xs text-gray-500">
                      <Upload className="h-4 w-4" />
                      {pdfPreview ? 'Ganti PDF' : 'Upload PDF (maks. 10MB)'}
                    </span>
                  )}
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={closeModal}
                  className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                  {(saving || uploading) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {uploading ? 'Mengupload PDF...' : saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Terbitkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
