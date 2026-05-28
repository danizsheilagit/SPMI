/**
 * Modal Tambah / Edit Butir Penilaian (instrument_components)
 * Fields: kode butir, seksi, pertanyaan audit, bukti dokumen, urutan
 */
import { useState, useEffect } from 'react'
import { X, Loader2, Save, AlertCircle } from 'lucide-react'

const EMPTY = { code: '', name: '', section: '', bukti_dokumen: '', description: '', sort_order: 0, answer_type: 'ppepp' }

export default function ComponentModal({ open, editItem, instrumentName, existingSections, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [customSection, setCustomSection] = useState(false)

  useEffect(() => {
    if (open) {
      setError(null)
      setCustomSection(false)
      if (editItem) {
        setForm({
          code: editItem.code || '',
          name: editItem.name || '',
          section: editItem.rubric_schema?.section || '',
          bukti_dokumen: editItem.rubric_schema?.bukti_dokumen || '',
          description: editItem.description || '',
          sort_order: editItem.sort_order || 0,
          answer_type: editItem.rubric_schema?.answer_type || 'ppepp',
        })
      } else {
        setForm(EMPTY)
      }
    }
  }, [open, editItem])

  if (!open) return null

  const sections = [...new Set((existingSections || []).filter(Boolean))]

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(form, editItem)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {editItem ? 'Edit Butir Penilaian' : 'Tambah Butir Penilaian'}
            </h2>
            {instrumentName && (
              <p className="text-xs text-gray-400 mt-0.5">Instrumen: {instrumentName}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">No / Kode *</label>
              <input required value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="cth: 1.1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Seksi / Grup</label>
              {!customSection && sections.length > 0 ? (
                <div className="flex gap-1.5">
                  <select value={form.section}
                    onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Pilih seksi —</option>
                    {sections.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" onClick={() => { setCustomSection(true); setForm(f => ({ ...f, section: '' })) }}
                    className="text-xs text-blue-600 hover:text-blue-700 whitespace-nowrap px-2">
                    + Baru
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <input value={form.section}
                    onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
                    placeholder="cth: Perencanaan Pembelajaran"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {sections.length > 0 && (
                    <button type="button" onClick={() => setCustomSection(false)}
                      className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap px-2">
                      Pilih
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipe Jawaban *</label>
            <div className="flex gap-2">
              {[
                { value: 'ppepp', label: 'Checklist PPEPP', desc: '5 tahap sekuensial dengan bukti per tahap' },
                { value: 'text',  label: 'Inputan Teks',    desc: 'Jawaban teks + upload bukti PDF' },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm(f => ({ ...f, answer_type: opt.value }))}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-left transition-all ${
                    form.answer_type === opt.value
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}>
                  <p className={`text-sm font-medium ${form.answer_type === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>{opt.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Pertanyaan Audit *</label>
            <textarea required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              rows={3}
              placeholder={form.answer_type === 'text'
                ? 'cth: Berapa prosentase MK yang CMPK nya sudah sesuai kurikulum?'
                : 'cth: Apakah SOP Pembelajaran tersedia dan disampaikan pada setiap rapat evaluasi dan persiapan semester'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bukti Dokumen</label>
            <input value={form.bukti_dokumen}
              onChange={e => setForm(f => ({ ...f, bukti_dokumen: e.target.value }))}
              placeholder="cth: SOP Pembelajaran"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Urutan Tampil</label>
            <input type="number" min={0} value={form.sort_order}
              onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              Batal
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Menyimpan...' : editItem ? 'Simpan Perubahan' : 'Tambah Butir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
