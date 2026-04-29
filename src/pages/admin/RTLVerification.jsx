/**
 * Admin/Auditor — Verifikasi RTL
 * Tabel semua RTL dari semua unit dengan filter dan aksi verifikasi.
 */
import { useEffect, useState } from 'react'
import {
  Loader2, AlertCircle, CheckCircle2, Clock, Circle,
  Filter, Search, Building2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_MAP = {
  open:        { label: 'Belum Mulai',       color: 'bg-gray-100 text-gray-600'    },
  in_progress: { label: 'Sedang Dikerjakan', color: 'bg-blue-100 text-blue-700'    },
  done:        { label: 'Selesai',           color: 'bg-green-100 text-green-700'  },
  verified:    { label: 'Terverifikasi',     color: 'bg-emerald-100 text-emerald-700' },
}

export default function RTLVerification() {
  const { user } = useAuth()
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [search,    setSearch]    = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [verifying, setVerifying] = useState(null)

  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('rtl_actions')
        .select(`
          id, description, status, target_date, evidence_url, updated_at,
          units            ( id, name, code ),
          instrument_components ( id, code, name ),
          rtm_findings     ( keputusan, batas_waktu )
        `)
        .order('updated_at', { ascending: false })
      if (e) throw e
      setItems(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(itemId) {
    setVerifying(itemId)
    setError(null)
    try {
      const { error: e } = await supabase
        .from('rtl_actions')
        .update({
          status:      'verified',
          verifier_id: user.id,
          verified_at: new Date().toISOString(),
          updated_at:  new Date().toISOString(),
        })
        .eq('id', itemId)
      if (e) throw e
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'verified' } : i))
    } catch (err) {
      setError(err.message)
    } finally {
      setVerifying(null)
    }
  }

  const filtered = items.filter(item => {
    const matchSearch = !search || [
      item.units?.name,
      item.instrument_components?.name,
      item.description,
    ].some(s => s?.toLowerCase().includes(search.toLowerCase()))

    const matchStatus = filterStatus === 'all' || item.status === filterStatus

    return matchSearch && matchStatus
  })

  const counts = {
    all:         items.length,
    open:        items.filter(i => i.status === 'open').length,
    in_progress: items.filter(i => i.status === 'in_progress').length,
    done:        items.filter(i => i.status === 'done').length,
    verified:    items.filter(i => i.status === 'verified').length,
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
      <span className="text-sm text-gray-500">Memuat data RTL...</span>
    </div>
  )

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Verifikasi RTL</h1>
        <p className="text-sm text-gray-500 mt-0.5">Verifikasi rencana tindak lanjut yang sudah selesai</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'open',        label: 'Belum Mulai',  icon: Circle,       color: 'text-gray-500' },
          { key: 'in_progress', label: 'Dikerjakan',   icon: Clock,        color: 'text-blue-500' },
          { key: 'done',        label: 'Selesai',      icon: CheckCircle2, color: 'text-green-500' },
          { key: 'verified',    label: 'Terverifikasi', icon: CheckCircle2, color: 'text-emerald-500' },
        ].map(({ key, label, icon: Icon, color }) => (
          <button key={key}
            onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
            className={`rounded-md border p-3 text-left transition-all ${
              filterStatus === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}>
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-lg font-bold text-gray-900">{counts[key]}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari unit, komponen, atau deskripsi..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">Semua Status</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_2fr_auto_auto] gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span>Unit</span>
          <span>Komponen</span>
          <span>Deskripsi RTL</span>
          <span>Status</span>
          <span>Aksi</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Tidak ada data RTL{filterStatus !== 'all' ? ` dengan status "${STATUS_MAP[filterStatus]?.label}"` : ''}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(item => {
              const s = STATUS_MAP[item.status] || STATUS_MAP.open
              return (
                <div key={item.id}
                  className="grid grid-cols-[1fr_1fr_2fr_auto_auto] gap-4 items-start px-5 py-3 hover:bg-gray-50">
                  {/* Unit */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{item.units?.name ?? '—'}</p>
                      <p className="text-[11px] text-gray-400">{item.units?.code}</p>
                    </div>
                  </div>

                  {/* Komponen */}
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-100 rounded px-1 mr-1">
                      {item.instrument_components?.code}
                    </span>
                    <p className="text-xs text-gray-700 truncate mt-0.5">{item.instrument_components?.name}</p>
                    {item.rtm_findings?.batas_waktu && (
                      <p className="text-[11px] text-amber-600 mt-0.5">
                        Batas: {new Date(item.rtm_findings.batas_waktu).toLocaleDateString('id-ID')}
                      </p>
                    )}
                  </div>

                  {/* Deskripsi */}
                  <p className="text-xs text-gray-700 line-clamp-2">{item.description}</p>

                  {/* Status */}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${s.color}`}>
                    {s.label}
                  </span>

                  {/* Aksi */}
                  <div>
                    {item.status === 'done' ? (
                      <button
                        onClick={() => handleVerify(item.id)}
                        disabled={verifying === item.id}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {verifying === item.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <CheckCircle2 className="h-3 w-3" />}
                        Verifikasi
                      </button>
                    ) : item.status === 'verified' ? (
                      <span className="text-xs text-emerald-600 font-medium">✅ Verified</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
