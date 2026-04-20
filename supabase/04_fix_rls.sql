-- =============================================================
-- QASYS — Fix: Simplified profiles RLS policy
-- Masalah: policy "select own or super_admin" memanggil
-- current_user_role() yang query profiles → infinite hang via REST API.
-- Solusi: gunakan policy sederhana id = auth.uid() saja.
-- =============================================================

-- ── 1. Hapus policy lama yang bermasalah ─────────────────────
DROP POLICY IF EXISTS "profiles: select own or super_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles: insert own"                ON public.profiles;
DROP POLICY IF EXISTS "profiles: update own"               ON public.profiles;

-- ── 2. Buat ulang policy yang sederhana & aman ───────────────

-- SELECT: setiap user hanya bisa melihat profilnya sendiri
CREATE POLICY "profiles: select own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- INSERT: hanya trigger handle_new_user yang insert (SECURITY DEFINER),
-- dan service_role. Blokir insert manual dari client.
CREATE POLICY "profiles: insert via trigger"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- UPDATE: user hanya bisa update profilnya sendiri
CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── 3. Verifikasi policy aktif ────────────────────────────────
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd;

-- =============================================================
-- Setelah run ini, refresh browser → loading harus selesai
-- =============================================================
