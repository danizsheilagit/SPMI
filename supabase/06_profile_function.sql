-- =============================================================
-- QASYS — Fix Permanent: Profile via SECURITY DEFINER function
-- Fungsi ini bypass RLS, berjalan as postgres (superuser).
-- auth.uid() tetap baca JWT sesi yang aktif.
-- =============================================================

-- ── 1. Buat fungsi get_my_profile() ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT row_to_json(p)
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

-- Izinkan dipanggil dari client (anon dan authenticated)
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO anon, authenticated;

-- ── 2. Re-enable RLS dengan policy yang bersih ───────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy untuk client langsung (ensure ada, skip jika sudah ada)
DROP POLICY IF EXISTS "profiles: select own" ON public.profiles;
CREATE POLICY "profiles: select own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- ── 3. Verifikasi ─────────────────────────────────────────────
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'get_my_profile';

SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'profiles';

-- =============================================================
-- Setelah ini, update AuthContext.jsx sudah otomatis via HMR
-- =============================================================
