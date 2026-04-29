-- ================================================================
-- QASYS Migration 14 — Auditor RLS Fix
-- Izinkan is_auditor users membaca submission & menulis findings
-- ================================================================

-- Helper: cek apakah user adalah auditor (role ATAU flag is_auditor)
CREATE OR REPLACE FUNCTION public.current_user_is_auditor()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT is_auditor FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ── 1. Fix submissions SELECT ─────────────────────────────────
-- Auditor (role/flag) bisa baca submissions dari unit yang ditugaskan
DROP POLICY IF EXISTS "submissions: auditee read own unit" ON public.submissions;
DROP POLICY IF EXISTS "submissions: read access" ON public.submissions;

CREATE POLICY "submissions: read access" ON public.submissions
  FOR SELECT USING (
    public.current_user_role() = 'super_admin'
    OR public.current_user_role() = 'pimpinan'
    -- Auditor (role atau is_auditor flag) hanya bisa baca yang ditugaskan
    OR (
      (public.current_user_role() = 'auditor' OR public.current_user_is_auditor())
      AND EXISTS (
        SELECT 1 FROM public.unit_instrument_auditors uia
        WHERE uia.unit_instrument_id = submissions.unit_instrument_id
          AND uia.auditor_id = auth.uid()
      )
    )
    -- Auditee hanya baca unit sendiri
    OR (
      public.current_user_role() = 'auditee'
      AND EXISTS (
        SELECT 1 FROM public.unit_instruments ui
        WHERE ui.id = submissions.unit_instrument_id
          AND ui.unit_id = public.current_user_unit()
      )
    )
  );

-- ── 2. Fix submissions UPDATE ──────────────────────────────────
-- Auditor bisa update status (under_review, verified)
DROP POLICY IF EXISTS "submissions: auditee update own unit" ON public.submissions;
DROP POLICY IF EXISTS "submissions: update access" ON public.submissions;

CREATE POLICY "submissions: update access" ON public.submissions
  FOR UPDATE
  -- USING: cek row LAMA (siapa yang boleh trigger update)
  USING (
    public.current_user_role() = 'super_admin'
    -- Auditor: boleh update submission yang ditugaskan ke mereka
    OR (
      (public.current_user_role() = 'auditor' OR public.current_user_is_auditor())
      AND EXISTS (
        SELECT 1 FROM public.unit_instrument_auditors uia
        WHERE uia.unit_instrument_id = submissions.unit_instrument_id
          AND uia.auditor_id = auth.uid()
      )
    )
    -- Auditee: hanya bisa update saat status masih draft atau revision_needed
    OR (
      public.current_user_role() = 'auditee'
      AND status IN ('draft', 'revision_needed')
      AND EXISTS (
        SELECT 1 FROM public.unit_instruments ui
        WHERE ui.id = submissions.unit_instrument_id
          AND ui.unit_id = public.current_user_unit()
      )
    )
  )
  -- WITH CHECK: cek row BARU (nilai apa yang boleh disimpan)
  WITH CHECK (
    public.current_user_role() = 'super_admin'
    -- Auditor: bebas set status apa pun pada submission yang ditugaskan
    OR (
      (public.current_user_role() = 'auditor' OR public.current_user_is_auditor())
      AND EXISTS (
        SELECT 1 FROM public.unit_instrument_auditors uia
        WHERE uia.unit_instrument_id = submissions.unit_instrument_id
          AND uia.auditor_id = auth.uid()
      )
    )
    -- Auditee: boleh set status apa pun (termasuk 'submitted') untuk unit sendiri
    OR (
      public.current_user_role() = 'auditee'
      AND EXISTS (
        SELECT 1 FROM public.unit_instruments ui
        WHERE ui.id = submissions.unit_instrument_id
          AND ui.unit_id = public.current_user_unit()
      )
    )
  );

-- ── 3. Fix audit_findings — izinkan is_auditor flag ───────────
DROP POLICY IF EXISTS "findings: write auditor or super_admin" ON public.audit_findings;
DROP POLICY IF EXISTS "findings: read authenticated" ON public.audit_findings;

CREATE POLICY "findings: write auditor or super_admin" ON public.audit_findings
  FOR ALL USING (
    public.current_user_role() IN ('super_admin', 'auditor')
    OR public.current_user_is_auditor()
  );

-- Verifikasi
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'current_user_is_auditor';
