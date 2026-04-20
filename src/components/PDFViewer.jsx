/**
 * PDF Viewer — renders a PDF in an iframe from a Supabase signed/public URL.
 */
import { useState, useEffect } from 'react'
import { FileX, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function PDFViewer({ storagePath, bucket = 'instrument-pdfs', height = '100%' }) {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!storagePath) {
      setLoading(false)
      return
    }

    async function fetchUrl() {
      setLoading(true)
      setError(null)
      try {
        if (bucket === 'instrument-pdfs') {
          const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)
          setUrl(data.publicUrl)
        } else {
          const { data, error: signErr } = await supabase.storage
            .from(bucket)
            .createSignedUrl(storagePath, 3600)
          if (signErr) throw signErr
          setUrl(data.signedUrl)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchUrl()
  }, [storagePath, bucket])

  if (!storagePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-400">
        <FileX className="h-12 w-12 mb-3 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">PDF Instrumen Belum Diunggah</p>
        <p className="text-xs mt-1">Hubungi Super Admin untuk mengunggah PDF instrumen ini.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <FileX className="h-10 w-10 text-red-300 mb-2" />
        <p className="text-sm text-red-500">Gagal memuat PDF</p>
        <p className="text-xs text-gray-400 mt-1">{error}</p>
      </div>
    )
  }

  return (
    <iframe
      src={`${url}#toolbar=1&navpanes=0`}
      title="PDF Instrumen"
      className="w-full border-0 rounded"
      style={{ height }}
    />
  )
}
