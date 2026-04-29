/**
 * Auditee — Daftar Instrumen yang Ditugaskan
 * Menampilkan instrumen yang harus diisi auditee berdasarkan unit_instruments.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ArrowRight, Loader2, ClipboardList } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import StatusBadge from '../../components/StatusBadge'

export default function SelfEvaluation() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.unit_id) fetchAssignments()
    else setLoading(false)
  }, [profile])

  async function fetchAssignments() {
    setLoading(true)
    // Get active cycle
    const { data: cycleData } = await supabase
      .from('audit_cycles')
      .select('id, name')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!cycleData) {
      setLoading(false)
      return
    }

    // Get unit_instruments for this unit in active cycle
    const { data } = await supabase
      .from('unit_instruments')
      .select(`
        id,
        instrument_id,
        instruments ( id, code, name, pdf_storage_path ),
        submissions ( id, status, updated_at )
      `)
      .eq('unit_id', profile.unit_id)
      .eq('cycle_id', cycleData.id)

    setAssignments(
      (data || []).map(a => ({
        ...a,
        cycle_name: cycleData.name,
        submission: a.submissions?.[0] || null,
      }))
    )
    setLoading(false)
  }

  function getStatus(submission) {
    return submission?.status ?? 'draft'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!profile?.unit_id) {
    return (
      <div className="max-w-2xl mx-auto rounded-md border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm font-medium text-amber-800">Akun Anda belum dikaitkan ke unit manapun.</p>
        <p className="text-xs text-amber-600 mt-1">Hubungi Super Admin untuk menetapkan unit Anda.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Evaluasi Diri</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Instrumen audit yang ditugaskan ke unit Anda — {profile.unit_name}
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-white p-10 text-center shadow-sm">
          <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Belum ada instrumen yang ditugaskan</p>
          <p className="text-xs text-gray-400 mt-1">
            Hubungi Super Admin jika seharusnya ada instrumen di sini.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {assignments[0]?.cycle_name} — {assignments.length} Instrumen
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {assignments.map(a => {
              const status = getStatus(a.submission)
              const inst = a.instruments

              return (
                <div key={a.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 shrink-0">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{inst?.name}</p>
                    <p className="text-xs text-gray-400">{inst?.code}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={status} />
                    {a.submission?.updated_at && (
                      <span className="text-xs text-gray-400">
                        Diubah {new Date(a.submission.updated_at).toLocaleDateString('id-ID')}
                      </span>
                    )}
                    <button
                      onClick={() => navigate(`/self-evaluation/${a.id}`)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      {status === 'draft' ? 'Mulai Isi' : 'Buka'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
