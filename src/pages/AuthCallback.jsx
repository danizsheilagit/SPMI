/**
 * OAuth Callback Handler — Fase 2
 * Menangani redirect dari Google OAuth.
 * Validasi domain email sebelum user diizinkan masuk.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ⚙️ Domain institusi & email yang diizinkan
const ALLOWED_DOMAIN = 'stikomyos.ac.id'
const ALLOWED_EMAILS = ['danizsheila@gmail.com']

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    async function handleCallback() {
      try {
        // supabase-js v2 otomatis exchange code dari URL hash/query
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Auth callback error:', error)
          navigate('/login?error=callback_failed', { replace: true })
          return
        }

        if (!session) {
          navigate('/login', { replace: true })
          return
        }

        // ── Validasi domain email ─────────────────────────────
        const email = session.user.email?.toLowerCase() ?? ''
        const domain = email.split('@')[1]?.toLowerCase()

        if (domain !== ALLOWED_DOMAIN && !ALLOWED_EMAILS.includes(email)) {
          // Domain tidak valid → paksa sign out
          await supabase.auth.signOut()
          navigate(
            `/login?error=domain_not_allowed&email=${encodeURIComponent(email)}`,
            { replace: true }
          )
          return
        }
        // ─────────────────────────────────────────────────────

        // Semua valid → masuk ke dashboard
        navigate('/dashboard', { replace: true })

      } catch (err) {
        console.error('Unexpected callback error:', err)
        navigate('/login?error=unexpected', { replace: true })
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-sm text-gray-500">Memverifikasi akun Anda...</p>
      </div>
    </div>
  )
}
