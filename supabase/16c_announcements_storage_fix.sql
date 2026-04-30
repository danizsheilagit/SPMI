-- ================================================================
-- Fix: Storage policies + announcements RLS dengan SECURITY DEFINER
-- ================================================================

-- 1. Buat fungsi is_admin() yang aman (SECURITY DEFINER bypass RLS profiles)
CREATE OR REPLACE FUNCTION public.is_admin_or_lpmpp()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'kepala_lpmpp')
  );
$$;

-- 2. Drop dan buat ulang RLS announcements dengan fungsi baru
DROP POLICY IF EXISTS "announcements: admin manage" ON public.announcements;
DROP POLICY IF EXISTS "announcements: read active"  ON public.announcements;

CREATE POLICY "announcements: admin manage" ON public.announcements
  FOR ALL
  USING      ( public.is_admin_or_lpmpp() )
  WITH CHECK ( public.is_admin_or_lpmpp() );

CREATE POLICY "announcements: read active" ON public.announcements
  FOR SELECT
  USING ( is_active = true AND auth.uid() IS NOT NULL );

-- 3. Buat bucket announcements (jika belum ada)
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies: admin bisa upload/delete, semua bisa baca
DROP POLICY IF EXISTS "announcements storage: public read"   ON storage.objects;
DROP POLICY IF EXISTS "announcements storage: admin insert"  ON storage.objects;
DROP POLICY IF EXISTS "announcements storage: admin delete"  ON storage.objects;

CREATE POLICY "announcements storage: public read" ON storage.objects
  FOR SELECT USING ( bucket_id = 'announcements' );

CREATE POLICY "announcements storage: admin insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'announcements'
    AND public.is_admin_or_lpmpp()
  );

CREATE POLICY "announcements storage: admin delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'announcements'
    AND public.is_admin_or_lpmpp()
  );

CREATE POLICY "announcements storage: admin update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'announcements'
    AND public.is_admin_or_lpmpp()
  );
