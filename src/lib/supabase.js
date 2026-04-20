import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Environment variables missing. Configure .env file.')
}

/**
 * Global fetch wrapper dengan timeout 8 detik.
 * Mencegah request PostgREST hanging tak terbatas.
 */
function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
    console.warn('[Supabase] Request timed out:', url.toString().split('?')[0])
  }, 8000)

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    global: {
      fetch: fetchWithTimeout,
    },
  }
)
