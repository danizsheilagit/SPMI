/**
 * Modal Preview Import CSV — tampilkan data sebelum bulk insert
 */
import { X, Loader2, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function ImportPreviewModal({ open, rows, instrumentName, importing, onConfirm, onClose }) {
  if (!open || !rows) return null

  // Group by section for preview
  const sections = {}
  rows.forEach(r => {
    const sec = r.section || '(Tanpa Seksi)'
    if (!sections[sec]) sections[sec] = []
    sections[sec].push(r)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Preview Import CSV</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Instrumen: {instrumentName} — {rows.length} butir ditemukan
            </p>
          </div>
          <button onClick={onClose} disabled={importing}
            className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {rows.length === 0 ? (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Tidak ada data valid dalam CSV.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(sections).map(([sec, items]) => (
                <div key={sec}>
                  <p className="text-xs font-semibold text-blue-700 bg-blue-50 rounded px-2.5 py-1 mb-2 inline-block">
                    {sec}
                  </p>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                        <th className="py-1.5 pr-2 w-16">No</th>
                        <th className="py-1.5 pr-2">Pertanyaan Audit</th>
                        <th className="py-1.5 pr-2 w-40">Bukti Dokumen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-1.5 pr-2 font-mono text-xs text-gray-600">{r.code}</td>
                          <td className="py-1.5 pr-2 text-gray-800">{r.name}</td>
                          <td className="py-1.5 pr-2 text-gray-500 text-xs">{r.bukti_dokumen}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} disabled={importing}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
            Batal
          </button>
          {rows.length > 0 && (
            <button onClick={onConfirm} disabled={importing}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 transition-colors">
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {importing ? 'Mengimpor...' : `Import ${rows.length} Butir`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
