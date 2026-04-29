import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const PROFILE_FETCH_TIMEOUT_MS = 6000

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const fetchGenRef = useRef(0)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth]', event, session?.user?.email ?? 'no user')
        setUser(session?.user ?? null)

        if (session?.user) {
          // Phase 1: set nama/avatar dari OAuth metadata
          // PENTING: jika sudah ada role dari DB (gen sebelumnya), pertahankan
          setProfile(prev => {
            const base = buildMetaProfile(session.user)
            if (prev?.role) {
              // Sudah punya role asli — hanya update nama/avatar, jangan reset role
              return { ...base, role: prev.role, unit_id: prev.unit_id, unit_name: prev.unit_name }
            }
            return base  // belum ada role → mulai dari metadata
          })

          // Phase 2: fetch role dari DB
          await fetchRealProfile()
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function buildMetaProfile(authUser) {
    const meta = authUser.user_metadata ?? {}
    return {
      id:         authUser.id,
      email:      authUser.email,
      full_name:  meta.full_name || meta.name || authUser.email?.split('@')[0],
      avatar_url: meta.avatar_url || meta.picture || null,
      role:       null,
      unit_id:    null,
      unit_name:  null,
    }
  }

  async function fetchRealProfile() {
    const gen = ++fetchGenRef.current

    const rpcPromise     = supabase.rpc('get_my_profile')
    const timeoutPromise = new Promise(resolve =>
      setTimeout(
        () => resolve({ data: null, error: new Error('timeout') }),
        PROFILE_FETCH_TIMEOUT_MS
      )
    )

    try {
      console.log('[Auth] fetchProfile gen:', gen)

      const { data, error } = await Promise.race([rpcPromise, timeoutPromise])

      // Buang hasil jika ada gen yang lebih baru
      if (gen !== fetchGenRef.current) {
        console.log('[Auth] gen', gen, 'discarded (newer exists)')
        return
      }

      if (error?.message === 'timeout') {
        console.warn('[Auth] Profile fetch timeout — role dipertahankan dari gen sebelumnya')
        // Tidak mengubah profile → role dari gen sebelumnya tetap berlaku
      } else if (error) {
        console.warn('[Auth] Profile RPC error:', error.message)
      } else if (data) {
        console.log('[Auth] Profile OK:', data.role, '/', data.full_name)
        setProfile(data)  // override dengan data lengkap dari DB
      }
    } catch (err) {
      if (gen !== fetchGenRef.current) return
      console.warn('[Auth] fetchProfile exception:', err.name)
    } finally {
      if (gen === fetchGenRef.current) {
        setLoading(false)
      }
    }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) throw error
  }

  async function signOut() {
    setProfile(null)
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = {
    user,
    profile,
    loading,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!user,
    role:           profile?.role ?? null,
    isSuperAdmin:   profile?.role === 'super_admin',
    isAuditee:      profile?.role === 'auditee',
    isPimpinan:     profile?.role === 'pimpinan',
    isKepalaLpmpp:  profile?.role === 'kepala_lpmpp',
    isAuditorFunc:  profile?.is_auditor ?? false,  // fungsi auditor (bukan role)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be inside AuthProvider')
  return context
}
