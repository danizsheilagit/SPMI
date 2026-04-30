/**
 * AnnouncementBanner — Banner pengumuman yang tampil di atas konten
 * Menampilkan pengumuman aktif terbaru. Klik untuk buka detail + PDF.
 * Auto-dismiss per sesi (localStorage). Navigasi multi-item.
 */
import { useEffect, useState } from 'react'
import { X, Megaphone, ChevronLeft, ChevronRight, FileText, ExternalLink, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function AnnouncementBanner() {
  const [items,     setItems]     = useState([])
  const [idx,       setIdx]       = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [modal,     setModal]     = useState(null)  // item detail
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const [pdfError,  setPdfError]  = useState(false)

  useEffect(() => {
    // Cek apakah user sudah dismiss di sesi ini
    const sessionKey = 'qasys_banner_dismissed'
    if (sessionStorage.getItem(sessionKey)) {
      setDismissed(true)
      return
    }
    loadAnnouncements()
  }, [])

  async function loadAnnouncements() {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, content, pdf_url, pdf_name, published_at')
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .limit(10)
    if (data && data.length > 0) setItems(data)
  }

  function dismiss() {
    sessionStorage.setItem('qasys_banner_dismissed', '1')
    setDismissed(true)
  }

  function openDetail(item) {
    setPdfLoaded(false)
    setPdfError(false)
    setModal(item)
  }

  if (dismissed || items.length === 0) return null

  const current = items[idx]

  return (
    <>
      {/* ── Banner bar ──────────────────────────────────────── */}
      <div className="relative bg-gradient-to-r from-blue-700 to-blue-600 text-white px-4 py-2.5 flex items-center gap-3 shadow-sm shrink-0">
        {/* Icon */}
        <div className="flex items-center gap-2 shrink-0">
          <Megaphone className="h-4 w-4 text-blue-200 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200 hidden sm:block">
            Pengumuman
          </span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-blue-500 shrink-0 hidden sm:block" />

        {/* Content — clickable */}
        <button
          onClick={() => openDetail(current)}
          className="flex-1 text-left text-sm font-medium truncate hover:underline min-w-0"
        >
          {current.title}
          {current.pdf_url && (
            <span className="ml-2 text-[11px] text-blue-200 font-normal">
              📎 Ada lampiran
            </span>
          )}
        </button>

        {/* Navigation (if multiple) */}
        {items.length > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIdx(i => (i - 1 + items.length) % items.length)}
              className="p-1 rounded hover:bg-blue-500 transition-colors"
              title="Sebelumnya"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] text-blue-200 font-mono w-8 text-center">
              {idx + 1}/{items.length}
            </span>
            <button
              onClick={() => setIdx(i => (i + 1) % items.length)}
              className="p-1 rounded hover:bg-blue-500 transition-colors"
              title="Berikutnya"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="p-1 rounded hover:bg-blue-500 transition-colors shrink-0"
          title="Tutup"
        >
          <X className="h-4 w-4 text-blue-200" />
        </button>
      </div>

      {/* ── Detail Modal ─────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-4xl rounded-lg bg-white shadow-2xl flex flex-col"
            style={{ maxHeight: '92vh' }}>

            {/* Modal header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 shrink-0">
                  <Megaphone className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">{modal.title}</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {modal.published_at
                      ? new Date(modal.published_at).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })
                      : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => setModal(null)}
                className="text-gray-400 hover:text-gray-600 shrink-0 mt-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto">
              {modal.content && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {modal.content}
                  </p>
                </div>
              )}

              {modal.pdf_url && (
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-blue-500" />
                      {modal.pdf_name || 'Lampiran PDF'}
                    </p>
                    <a href={modal.pdf_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3.5 w-3.5" /> Buka / Download
                    </a>
                  </div>

                  <div className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-100"
                    style={{ height: '52vh' }}>
                    {!pdfLoaded && !pdfError && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-100">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        <span className="ml-2 text-sm text-gray-500">Memuat dokumen...</span>
                      </div>
                    )}
                    {pdfError ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <FileText className="h-10 w-10 text-gray-300" />
                        <a href={modal.pdf_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                          <ExternalLink className="h-3.5 w-3.5" /> Buka / Download PDF
                        </a>
                      </div>
                    ) : (
                      <iframe
                        src={modal.pdf_url}
                        className="w-full h-full border-0"
                        title={modal.pdf_name || 'Lampiran'}
                        onLoad={() => setPdfLoaded(true)}
                        onError={() => setPdfError(true)}
                      />
                    )}
                  </div>
                </div>
              )}

              {!modal.content && !modal.pdf_url && (
                <p className="px-5 py-8 text-center text-sm text-gray-400">Tidak ada detail tambahan.</p>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex items-center justify-between">
              {/* Navigate between announcements from modal */}
              {items.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { const ni = (idx - 1 + items.length) % items.length; setIdx(ni); setPdfLoaded(false); setPdfError(false); setModal(items[ni]) }}
                    className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
                  </button>
                  <span className="text-xs text-gray-400">{idx + 1} / {items.length}</span>
                  <button
                    onClick={() => { const ni = (idx + 1) % items.length; setIdx(ni); setPdfLoaded(false); setPdfError(false); setModal(items[ni]) }}
                    className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    Berikutnya <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <button onClick={() => setModal(null)}
                className="ml-auto rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
