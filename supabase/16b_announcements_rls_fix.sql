-- ================================================================
-- Fix RLS for announcements table
-- Ganti current_user_role() dengan subquery langsung ke profiles
-- ================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "announcements: admin manage" ON public.announcements;
DROP POLICY IF EXISTS "announcements: read active"  ON public.announcements;

-- Super Admin + Kepala LPMPP: full CRUD
CREATE POLICY "announcements: admin manage" ON public.announcements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'kepala_lpmpp')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'kepala_lpmpp')
    )
  );

-- Semua authenticated bisa baca yang aktif
CREATE POLICY "announcements: read active" ON public.announcements
  FOR SELECT
  USING ( is_active = true AND auth.uid() IS NOT NULL );
