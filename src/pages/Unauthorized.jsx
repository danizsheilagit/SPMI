import { useNavigate } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Unauthorized() {
  const navigate = useNavigate()
  const { role, signOut } = useAuth()

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-4">
            <ShieldOff className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <h1 className="text-lg font-bold text-gray-900">Akses Ditolak</h1>
        <p className="text-sm text-gray-500">
          Anda tidak memiliki izin untuk mengakses halaman ini.
          {role && <> (Role saat ini: <span className="font-medium">{role}</span>)</>}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Ke Dashboard
          </button>
          <button
            onClick={signOut}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Keluar
          </button>
        </div>
      </div>
    </div>
  )
}
