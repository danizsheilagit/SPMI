/**
 * Auditor & Auditee — Halaman Pengumuman
 * Daftar pengumuman aktif. Klik untuk melihat detail dan PDF via iframe.
 */
import { useEffect, useState } from 'react'
import {
  Megaphone, Loader2, AlertCircle, FileText, Calendar,
  ChevronRight, X, ExternalLink,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function AnnouncementsPage() {
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [selected, setSelected] = useState(null) // item yang sedang dilihat detail

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    setLoading(true)
    try {
      const { data, error: e } = await supabase
        .from('announcements')
        .select('*, profiles:created_by(full_name)')
        .eq('is_active', true)
        .order('published_at', { ascending: false })
      if (e) throw e
      setItems(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  /* ── Detail Modal ─────────────────────────────────────────── */
  function AnnouncementDetail({ item, onClose }) {
    const [pdfLoaded, setPdfLoaded] = useState(false)
    const [pdfError,  setPdfError]  = useState(false)

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-4xl rounded-lg bg-white shadow-2xl flex flex-col"
          style={{ maxHeight: '92vh' }}>

          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 shrink-0">
                <Megaphone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">{item.title}</h2>
                <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(item.published_at || item.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                  {item.profiles?.full_name && (
                    <span>oleh {item.profiles.full_name}</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 mt-1">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {/* Isi teks */}
            {item.content && (
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {item.content}
                </p>
              </div>
            )}

            {/* PDF Viewer via iframe */}
            {item.pdf_url && (
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-blue-500" />
                    {item.pdf_name || 'Lampiran PDF'}
                  </p>
                  <a href={item.pdf_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <ExternalLink className="h-3.5 w-3.5" /> Buka di tab baru
                  </a>
                </div>

                {/* iframe PDF */}
                <div className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-100"
                  style={{ height: '55vh' }}>
                  {!pdfLoaded && !pdfError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                      <span className="ml-2 text-sm text-gray-500">Memuat PDF...</span>
                    </div>
                  )}
                  {pdfError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                      <FileText className="h-10 w-10 text-gray-300" />
                      <p className="text-sm text-gray-500 text-center">
                        PDF tidak dapat ditampilkan di browser ini.
                      </p>
                      <a href={item.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                        <ExternalLink className="h-3.5 w-3.5" /> Download PDF
                      </a>
                    </div>
                  )}
                  <iframe
                    src={`${item.pdf_url}#toolbar=1&navpanes=0&scrollbar=1`}
                    className="w-full h-full"
                    title={item.pdf_name || 'Lampiran PDF'}
                    onLoad={() => setPdfLoaded(true)}
                    onError={() => setPdfError(true)}
                    style={{ display: pdfError ? 'none' : 'block' }}
                  />
                </div>
              </div>
            )}

            {/* Jika tidak ada konten sama sekali */}
            {!item.content && !item.pdf_url && (
              <div className="px-5 py-10 text-center text-sm text-gray-400">
                Tidak ada detail tambahan untuk pengumuman ini.
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-100 shrink-0">
            <button onClick={onClose}
              className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Tutup
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Main Render ──────────────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
      <span className="text-sm text-gray-500">Memuat pengumuman...</span>
    </div>
  )

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Pengumuman</h1>
        <p className="text-sm text-gray-500 mt-0.5">Informasi dan undangan dari LPMPP</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-12 text-center">
          <Megaphone className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Belum ada pengumuman</p>
          <p className="text-xs text-gray-400 mt-1">Pengumuman akan muncul di sini jika sudah diterbitkan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="w-full rounded-md border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 shrink-0">
                  <Megaphone className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(item.published_at || item.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </span>
                    {item.pdf_url && (
                      <span className="flex items-center gap-1 text-blue-500">
                        <FileText className="h-3 w-3" /> Ada lampiran PDF
                      </span>
                    )}
                  </div>
                  {item.content && (
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{item.content}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <AnnouncementDetail item={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
