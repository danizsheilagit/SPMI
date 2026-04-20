-- =============================================================
-- QASYS — User Management Functions v3 (pure SQL, no plpgsql)
-- Menggunakan LANGUAGE sql untuk menghindari masalah SELECT INTO
-- =============================================================

-- ── 1. List semua profil (super admin only) ───────────────────
CREATE OR REPLACE FUNCTION public.get_all_profiles()
RETURNS TABLE(
  id          uuid,
  email       text,
  full_name   text,
  avatar_url  text,
  role        text,
  unit_id     uuid,
  unit_name   text,
  created_at  timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT
    p.id, p.email, p.full_name, p.avatar_url,
    p.role::text, p.unit_id, p.unit_name, p.created_at
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'::user_role
  )
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_profiles() TO authenticated;

-- ── 2. Update profil user lain (super admin only) ─────────────
-- Menggunakan LANGUAGE sql + WHERE EXISTS untuk otorisasi
CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_user_id   uuid,
  p_role      text,
  p_unit_id   uuid DEFAULT NULL,
  p_full_name text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  UPDATE public.profiles
  SET
    role      = p_role::user_role,
    unit_id   = p_unit_id,
    unit_name = (SELECT name FROM public.units WHERE id = p_unit_id),
    full_name = COALESCE(NULLIF(p_full_name, ''), full_name)
  WHERE
    id = p_user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'::user_role
    );
$$;

GRANT EXECUTE ON FUNCTION public.update_user_profile(uuid, text, uuid, text) TO authenticated;

-- ── 3. Verifikasi ─────────────────────────────────────────────
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_all_profiles', 'update_user_profile')
ORDER BY routine_name;
