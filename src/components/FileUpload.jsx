/**
 * Reusable file uploader — Supabase Storage
 * Props:
 *   bucket       — storage bucket name
 *   storagePath  — full path inside bucket (include filename)
 *   existingPath — path already stored (to show existing file)
 *   onUploaded   — callback(storagePath, fileName, publicUrl)
 *   onDeleted    — callback()
 *   disabled     — lock uploaded state (form submitted)
 *   accept       — MIME types string (default: PDF + images)
 */
import { useRef, useState } from 'react'
import { Upload, FileText, Trash2, Loader2, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function FileUpload({
  bucket = 'evidence-files',
  storagePath,
  existingPath = null,
  existingName = null,
  onUploaded,
  onDeleted,
  disabled = false,
  accept = 'application/pdf,image/jpeg,image/png',
}) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const hasFile = !!existingPath

  // Get public or signed URL for viewing
  async function getFileUrl() {
    if (!existingPath) return null
    if (bucket === 'instrument-pdfs') {
      const { data } = supabase.storage.from(bucket).getPublicUrl(existingPath)
      return data.publicUrl
    } else {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(existingPath, 3600) // 1 hour
      if (error) return null
      return data.signedUrl
    }
  }

  async function handleViewFile() {
    const url = await getFileUrl()
    if (url) window.open(url, '_blank')
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploading(true)

    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get URL
      let publicUrl = null
      if (bucket === 'instrument-pdfs') {
        const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)
        publicUrl = data.publicUrl
      }

      onUploaded?.(storagePath, file.name, publicUrl)
    } catch (err) {
      setError(err.message || 'Upload gagal')
    } finally {
      setUploading(false)
      // Reset input so same file can be re-uploaded
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete() {
    if (!existingPath) return
    try {
      await supabase.storage.from(bucket).remove([existingPath])
    } catch {
      // Ignore storage delete errors — we still clear local state
    }
    onDeleted?.()
  }

  if (hasFile) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
        <FileText className="h-4 w-4 shrink-0 text-green-600" />
        <span className="flex-1 truncate text-xs font-medium text-green-700">
          {existingName || existingPath?.split('/').pop() || 'File terunggah'}
        </span>
        <button
          onClick={handleViewFile}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-green-700 hover:bg-green-100 transition-colors"
          title="Lihat file"
        >
          <Eye className="h-3.5 w-3.5" /> Lihat
        </button>
        {!disabled && (
          <button
            onClick={handleDelete}
            className="rounded p-0.5 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Hapus file"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleUpload}
        disabled={uploading || disabled}
        className="hidden"
        id={`upload-${storagePath?.replace(/\//g, '-')}`}
      />
      <label
        htmlFor={`upload-${storagePath?.replace(/\//g, '-')}`}
        className={`
          inline-flex items-center gap-1.5 cursor-pointer rounded-md border px-3 py-1.5
          text-xs font-medium transition-colors
          ${disabled
            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
          }
        `}
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {uploading ? 'Mengunggah...' : 'Unggah Bukti'}
      </label>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
