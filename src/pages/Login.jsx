/**
 * QASYS Login Page — Fase 2
 * Cloudflare-inspired clean login with Google SSO only.
 */
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Pesan error dari URL param (dikirim oleh AuthCallback)
const ERROR_MESSAGES = {
  domain_not_allowed: 'Email Anda tidak terdaftar dalam domain institusi yang diizinkan.',
  callback_failed: 'Gagal menyelesaikan proses login. Silakan coba lagi.',
  unexpected: 'Terjadi kesalahan tak terduga. Silakan coba lagi.',
}


// Google SVG logo
function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

export default function Login() {
  const { signInWithGoogle } = useAuth()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Error dari redirect AuthCallback (mis. domain tidak valid)
  const urlError = searchParams.get('error')
  const urlEmail = searchParams.get('email')
  const displayError = error
    ?? (urlError ? (ERROR_MESSAGES[urlError] ?? 'Terjadi kesalahan.') : null)

  // Tampilkan email yang ditolak jika ada
  const errorDetail = urlError === 'domain_not_allowed' && urlEmail
    ? `Email yang digunakan: ${decodeURIComponent(urlEmail)}`
    : null

  async function handleLogin() {
    setError(null)
    setLoading(true)
    try {
      await signInWithGoogle()
      // Supabase will redirect; no need to handle state here
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan. Silakan coba lagi.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      {/* Background subtle grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(to right, #94a3b8 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Login Card */}
      <div className="relative w-full max-w-sm">
        {/* Header accent bar */}
        <div className="h-1 w-full rounded-t-lg bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600" />

        <div className="rounded-b-lg border border-gray-200 bg-white px-8 py-9 shadow-sm">
          {/* Brand */}
          <div className="mb-7 flex flex-col items-center text-center">
            <img
              src="/logo-sys.png"
              alt="STIKOM Yos Sudarso"
              className="mb-3 h-20 w-20 object-contain drop-shadow-sm"
            />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">QASYS</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
              Sistem Informasi Penjaminan Mutu Internal
              <br />
              <span className="font-medium text-gray-600">STIKOM Yos Sudarso</span>
            </p>
          </div>

          {/* Divider */}
          <div className="mb-6 border-t border-gray-100" />

          {/* Description */}
          <p className="mb-5 text-center text-sm text-gray-500">
            Masuk hanya dengan akun institusi resmi Anda.
          </p>

          {/* Error Alert */}
          {displayError && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <span>{displayError}</span>
                {errorDetail && (
                  <p className="mt-1 text-xs text-red-500">{errorDetail}</p>
                )}
              </div>
            </div>
          )}

          {/* Google SSO Button */}
          <button
            id="btn-login-google"
            onClick={handleLogin}
            disabled={loading}
            className="
              flex w-full items-center justify-center gap-3 rounded-md
              bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white
              shadow-sm transition-all duration-150
              hover:bg-blue-700 hover:shadow-md
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-60
            "
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <GoogleIcon />
            )}
            <span>{loading ? 'Mengalihkan...' : 'Login dengan Email Institusi'}</span>
          </button>

          {/* Footer note */}
          <p className="mt-5 text-center text-xs text-gray-400">
            Hanya akun dengan domain institusi yang diizinkan.
            <br />
            Hubungi admin jika Anda tidak dapat masuk.
          </p>
        </div>

        {/* Bottom label */}
        <p className="mt-4 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} STIKOM Yos Sudarso · SPMI
        </p>
      </div>
    </div>
  )
}
