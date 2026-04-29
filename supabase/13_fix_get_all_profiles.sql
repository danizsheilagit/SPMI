-- ================================================================
-- QASYS — Fix: tambah is_auditor ke RPC get_all_profiles
-- Harus DROP dulu karena return type berubah
-- ================================================================

-- Step 1: Drop function lama
DROP FUNCTION IF EXISTS public.get_all_profiles();

-- Step 2: Recreate dengan is_auditor
CREATE OR REPLACE FUNCTION public.get_all_profiles()
RETURNS TABLE(
  id          uuid,
  email       text,
  full_name   text,
  avatar_url  text,
  role        text,
  unit_id     uuid,
  unit_name   text,
  is_auditor  boolean,
  created_at  timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT
    p.id, p.email, p.full_name, p.avatar_url,
    p.role::text, p.unit_id, p.unit_name,
    p.is_auditor,
    p.created_at
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'::user_role
  )
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_profiles() TO authenticated;

-- Verifikasi
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'get_all_profiles';
