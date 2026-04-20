-- =============================================================
-- QASYS — Dashboard Stats & Recent User Activity
-- =============================================================

-- ── 1. Statistik dashboard (super_admin) ─────────────────────
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT json_build_object(
    'total_instruments',   (SELECT COUNT(*) FROM public.instruments  WHERE is_active  = true),
    'total_units',         (SELECT COUNT(*) FROM public.units        WHERE is_active  = true),
    'total_users',         (SELECT COUNT(*) FROM public.profiles),
    'active_cycle_name',   (SELECT name     FROM public.audit_cycles WHERE is_active  = true LIMIT 1),
    'total_submissions',   (SELECT COUNT(*) FROM public.submissions),
    'pending_review',      (SELECT COUNT(*) FROM public.submissions  WHERE status IN ('submitted','under_review')),
    'open_findings',       (SELECT COUNT(*) FROM public.audit_findings),
    'verified_submissions',(SELECT COUNT(*) FROM public.submissions  WHERE status = 'verified')
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

-- ── 2. Login activity terbaru (baca auth.users.last_sign_in_at) ─
CREATE OR REPLACE FUNCTION public.get_recent_user_activity(p_limit int DEFAULT 10)
RETURNS TABLE(
  id              uuid,
  email           text,
  full_name       text,
  avatar_url      text,
  role            text,
  last_sign_in_at timestamptz,
  joined_at       timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    p.role::text,
    u.last_sign_in_at,
    p.created_at AS joined_at
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('super_admin'::user_role, 'kepala_lpmpp'::user_role)
  )
  ORDER BY u.last_sign_in_at DESC NULLS LAST
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_user_activity(int) TO authenticated;

-- ── 3. Penugasan instrumen terbaru ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_recent_assignments(p_limit int DEFAULT 5)
RETURNS TABLE(
  id           uuid,
  unit_name    text,
  instrument_name text,
  cycle_name   text,
  created_at   timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT
    ui.id,
    u.name  AS unit_name,
    i.name  AS instrument_name,
    ac.name AS cycle_name,
    ui.created_at
  FROM public.unit_instruments ui
  JOIN public.units        u  ON u.id  = ui.unit_id
  JOIN public.instruments  i  ON i.id  = ui.instrument_id
  JOIN public.audit_cycles ac ON ac.id = ui.cycle_id
  ORDER BY ui.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_assignments(int) TO authenticated;

-- ── Verifikasi ─────────────────────────────────────────────────
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_dashboard_stats','get_recent_user_activity','get_recent_assignments')
ORDER BY routine_name;
