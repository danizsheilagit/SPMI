/**
 * Pimpinan — RTM List Page
 * Satu RTM per siklus. Pimpinan hanya mengisi keputusan untuk unit yang di-assign ke mereka.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, Loader2, Plus, CheckCircle2,
  Edit3, Send, Calendar, Building2, AlertCircle, RotateCcw,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const STATUS = {
  draft:     { label: 'Draft',       color: 'bg-gray-100 text-gray-600'   },
  published: { label: 'Dipublish ✅', color: 'bg-green-100 text-green-700' },
}

export default function RTMPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rtmList,  setRtmList]  = useState([])
  const [cycles,   setCycles]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)
  const [error,    setError]    = useState(null)

  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      // Load existing RTMs
      const { data: rtms, error: e1 } = await supabase
        .from('rtm_sessions')
        .select(`
          id, title, held_at, notes, is_published, created_at, updated_at,
          audit_cycles ( id, name, academic_year, is_active )
        `)
        .order('created_at', { ascending: false })
      if (e1) throw e1

      // Load active cycles that don't have RTM yet
      const { data: allCycles, error: e2 } = await supabase
        .from('audit_cycles')
        .select('id, name, academic_year, is_active')
        .order('created_at', { ascending: false })
      if (e2) throw e2

      const rtmCycleIds = new Set((rtms || []).map(r => r.audit_cycles?.id).filter(Boolean))
      setCycles((allCycles || []).filter(c => !rtmCycleIds.has(c.id)))
      setRtmList(rtms || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function createRTM(cycleId, cycleName) {
    setCreating(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('rtm_sessions')
        .insert({
          cycle_id:   cycleId,
          title:      `RTM ${cycleName}`,
          created_by: user.id,
        })
        .select()
        .single()
      if (e) throw e
      navigate(`/rtm/${data.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function publishRTM(rtmId) {
    if (!confirm('Publish RTM? Keputusan akan terlihat oleh Auditee dan tidak bisa diedit.')) return
    try {
      const { error: e } = await supabase
        .from('rtm_sessions')
        .update({ is_published: true, updated_at: new Date().toISOString() })
        .eq('id', rtmId)
      if (e) throw e
      setRtmList(list => list.map(r => r.id === rtmId ? { ...r, is_published: true } : r))
    } catch (err) {
      setError(err.message)
    }
  }

  async function reopenRTM(rtmId) {
    if (!confirm('Buka kembali RTM ini? Status akan kembali ke Draft.')) return
    try {
      const { error: e } = await supabase
        .from('rtm_sessions')
        .update({ is_published: false, updated_at: new Date().toISOString() })
        .eq('id', rtmId)
      if (e) throw e
      setRtmList(list => list.map(r => r.id === rtmId ? { ...r, is_published: false } : r))
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-500">Memuat RTM...</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Rapat Tinjau Manajemen</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Buat keputusan RTM per siklus untuk unit yang Anda supervisi
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Buat RTM baru */}
      {cycles.length > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-700 mb-3">
            Siklus belum memiliki RTM:
          </p>
          <div className="flex flex-wrap gap-2">
            {cycles.map(c => (
              <button
                key={c.id}
                onClick={() => createRTM(c.id, c.name)}
                disabled={creating}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Buat RTM — {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Daftar RTM */}
      {rtmList.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-10 text-center">
          <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Belum ada RTM</p>
          <p className="text-xs text-gray-400 mt-1">Buat RTM dari siklus yang tersedia di atas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rtmList.map(rtm => {
            const status = rtm.is_published ? 'published' : 'draft'
            const s = STATUS[status]
            return (
              <div
                key={rtm.id}
                className="rounded-md border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color}`}>
                        {s.label}
                      </span>
                      <h2 className="text-sm font-semibold text-gray-900 truncate">{rtm.title}</h2>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      {rtm.held_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(rtm.held_at).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {rtm.audit_cycles?.name}
                      </span>
                    </div>
                    {rtm.notes && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{rtm.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!rtm.is_published && (
                      <>
                        <button
                          onClick={() => navigate(`/rtm/${rtm.id}`)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Edit3 className="h-3 w-3" /> Isi Keputusan
                        </button>
                        <button
                          onClick={() => publishRTM(rtm.id)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          <Send className="h-3 w-3" /> Publish RTM
                        </button>
                      </>
                    )}
                    {rtm.is_published && (
                      <>
                        <button
                          onClick={() => navigate(`/rtm/${rtm.id}`)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          <CheckCircle2 className="h-3 w-3 text-green-500" /> Lihat Detail
                        </button>
                        <button
                          onClick={() => reopenRTM(rtm.id)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                        >
                          <RotateCcw className="h-3 w-3" /> Buka Kembali
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
