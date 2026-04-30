/**
 * AnnouncementBanner — Kartu pengumuman dengan efek slide
 * Tampil di atas konten (di bawah Header). Setiap pengumuman = 1 kartu.
 * Klik kartu untuk buka detail + PDF. Auto-slide setiap 6 detik.
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  X, Megaphone, ChevronLeft, ChevronRight,
  FileText, ExternalLink, Loader2, Calendar,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

/* ── Detail Modal ────────────────────────────────────────────── */
function DetailModal({ item, items, idx, setIdx, onClose }) {
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const [pdfError,  setPdfError]  = useState(false)

  function goTo(newIdx) {
    setPdfLoaded(false)
    setPdfError(false)
    setIdx(newIdx)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl flex flex-col"
        style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 shrink-0">
              <Megaphone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{item.title}</h2>
              <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {item.published_at
                  ? new Date(item.published_at).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })
                  : '—'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-1 shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {item.content && (
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.content}</p>
            </div>
          )}

          {item.pdf_url && (
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-500" />
                  {item.pdf_name || 'Lampiran PDF'}
                </p>
                <a href={item.pdf_url} target="_blank" rel="noopener noreferrer"
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
                    <a href={item.pdf_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                      <ExternalLink className="h-3.5 w-3.5" /> Buka / Download PDF
                    </a>
                  </div>
                ) : (
                  <iframe src={item.pdf_url} className="w-full h-full border-0"
                    title={item.pdf_name || 'Lampiran'}
                    onLoad={() => setPdfLoaded(true)}
                    onError={() => setPdfError(true)} />
                )}
              </div>
            </div>
          )}

          {!item.content && !item.pdf_url && (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Tidak ada detail tambahan.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex items-center justify-between">
          {items.length > 1 ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => goTo((idx - 1 + items.length) % items.length)}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
                <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
              </button>
              <span className="text-xs text-gray-400 font-mono">{idx + 1}/{items.length}</span>
              <button
                onClick={() => goTo((idx + 1) % items.length)}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
                Berikutnya <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : <span />}
          <button onClick={onClose}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Banner ─────────────────────────────────────────────── */
export default function AnnouncementBanner() {
  const [items,     setItems]     = useState([])
  const [idx,       setIdx]       = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [modalIdx,  setModalIdx]  = useState(null)   // index item di modal
  const [sliding,   setSliding]   = useState(false)
  const [direction, setDirection] = useState('right') // arah slide
  const timerRef = useRef(null)

  useEffect(() => {
    if (sessionStorage.getItem('qasys_banner_dismissed')) {
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

  // Auto-slide setiap 6 detik jika > 1 item
  useEffect(() => {
    if (items.length <= 1) return
    timerRef.current = setInterval(() => slideTo('right', (idx + 1) % items.length), 6000)
    return () => clearInterval(timerRef.current)
  }, [items, idx])

  const slideTo = useCallback((dir, newIdx) => {
    if (sliding) return
    clearInterval(timerRef.current)
    setDirection(dir)
    setSliding(true)
    setTimeout(() => {
      setIdx(newIdx)
      setSliding(false)
    }, 280)
  }, [sliding])

  function prev() { slideTo('left',  (idx - 1 + items.length) % items.length) }
  function next() { slideTo('right', (idx + 1) % items.length) }

  function dismiss() {
    sessionStorage.setItem('qasys_banner_dismissed', '1')
    setDismissed(true)
  }

  if (dismissed || items.length === 0) return null

  const current = items[idx]

  return (
    <>
      {/* ── Kartu Slider ──────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0 shrink-0">
        <div className="relative overflow-hidden">

          {/* Kartu */}
          <div
            key={idx}
            className={`bg-gradient-to-r from-blue-700 to-blue-500 rounded-xl shadow-md text-white
              transition-all duration-300 ease-out
              ${sliding
                ? direction === 'right'
                  ? 'opacity-0 translate-x-4'
                  : 'opacity-0 -translate-x-4'
                : 'opacity-100 translate-x-0'
              }`}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Icon */}
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-white/15 shrink-0">
                <Megaphone className="h-4.5 w-4.5 text-white h-4 w-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200">
                    Pengumuman
                  </span>
                  {items.length > 1 && (
                    <span className="text-[10px] text-blue-300 font-mono">
                      {idx + 1}/{items.length}
                    </span>
                  )}
                  {current.pdf_url && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-200">
                      <FileText className="h-2.5 w-2.5" /> Lampiran
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setModalIdx(idx)}
                  className="block text-sm font-semibold text-left truncate hover:underline w-full max-w-lg"
                >
                  {current.title}
                </button>
                {current.content && (
                  <p className="text-xs text-blue-100 truncate mt-0.5 max-w-lg">
                    {current.content}
                  </p>
                )}
              </div>

              {/* Nav buttons (hanya jika > 1) */}
              {items.length > 1 && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={prev}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={next}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Buka detail */}
              <button
                onClick={() => setModalIdx(idx)}
                className="shrink-0 text-[11px] font-medium bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors hidden sm:block"
              >
                Lihat Detail
              </button>

              {/* Dismiss */}
              <button onClick={dismiss}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                title="Tutup">
                <X className="h-3.5 w-3.5 text-blue-200" />
              </button>
            </div>

            {/* Dot indicators */}
            {items.length > 1 && (
              <div className="flex justify-center gap-1.5 pb-2">
                {items.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => slideTo(i > idx ? 'right' : 'left', i)}
                    className={`rounded-full transition-all duration-200 ${
                      i === idx ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Detail Modal ──────────────────────────────────── */}
      {modalIdx !== null && (
        <DetailModal
          item={items[modalIdx]}
          items={items}
          idx={modalIdx}
          setIdx={(i) => setModalIdx(i)}
          onClose={() => setModalIdx(null)}
        />
      )}
    </>
  )
}
