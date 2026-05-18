/**
 * Modal Tambah / Edit Instrumen
 */
import { useState, useEffect } from 'react'
import { X, Loader2, Save, AlertCircle } from 'lucide-react'

const EMPTY = { code: '', name: '', description: '', is_active: true }

export default function InstrumentModal({ open, editItem, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setError(null)
      if (editItem) {
        setForm({
          code: editItem.code || '',
          name: editItem.name || '',
          description: editItem.description || '',
          is_active: editItem.is_active !== false,
        })
      } else {
        setForm(EMPTY)
      }
    }
  }, [open, editItem])

  if (!open) return null

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
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl animate-in fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {editItem ? 'Edit Instrumen' : 'Tambah Instrumen Baru'}
          </h2>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kode *</label>
              <input required value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="cth: INST-12"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={form.is_active === true}
                    onChange={() => setForm(f => ({ ...f, is_active: true }))}
                    className="accent-blue-600" />
                  Aktif
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={form.is_active === false}
                    onChange={() => setForm(f => ({ ...f, is_active: false }))}
                    className="accent-blue-600" />
                  Nonaktif
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nama Instrumen *</label>
            <input required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="cth: Pendidikan"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Deskripsi</label>
            <textarea value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} placeholder="Deskripsi singkat instrumen..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
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
              {saving ? 'Menyimpan...' : editItem ? 'Simpan Perubahan' : 'Tambah Instrumen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
