-- ================================================================
-- QASYS Migration 15 — RTM + RTL Extended
-- Rapat Tinjau Manajemen → Rencana Tindak Lanjut per komponen
-- ================================================================

-- ── 1. Tambah assigned_pimpinan_id ke units ────────────────────
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS assigned_pimpinan_id UUID REFERENCES public.profiles(id);

-- ── 2. Tabel rtm_sessions (1 per siklus) ──────────────────────
CREATE TABLE IF NOT EXISTS public.rtm_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id     UUID NOT NULL UNIQUE REFERENCES public.audit_cycles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  held_at      DATE,
  notes        TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rtm_sessions ENABLE ROW LEVEL SECURITY;

-- ── 3. Tabel rtm_findings (keputusan per unit+komponen) ────────
CREATE TABLE IF NOT EXISTS public.rtm_findings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rtm_id         UUID NOT NULL REFERENCES public.rtm_sessions(id) ON DELETE CASCADE,
  unit_id        UUID NOT NULL REFERENCES public.units(id),
  instrument_id  UUID NOT NULL REFERENCES public.instruments(id),
  component_id   UUID NOT NULL REFERENCES public.instrument_components(id),
  keputusan      TEXT NOT NULL,
  batas_waktu    DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rtm_id, unit_id, component_id)
);

ALTER TABLE public.rtm_findings ENABLE ROW LEVEL SECURITY;

-- ── 4. Alter rtl_actions — tambah component_id & rtm_finding_id
ALTER TABLE public.rtl_actions
  ADD COLUMN IF NOT EXISTS component_id    UUID REFERENCES public.instrument_components(id),
  ADD COLUMN IF NOT EXISTS rtm_finding_id  UUID REFERENCES public.rtm_findings(id);

-- ── 5. RLS: rtm_sessions ───────────────────────────────────────
-- Semua authenticated bisa baca
DROP POLICY IF EXISTS "rtm_sessions: read authenticated" ON public.rtm_sessions;
CREATE POLICY "rtm_sessions: read authenticated" ON public.rtm_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Pimpinan bisa buat/edit RTM untuk siklus yang ada unit mereka
DROP POLICY IF EXISTS "rtm_sessions: pimpinan manage" ON public.rtm_sessions;
CREATE POLICY "rtm_sessions: pimpinan manage" ON public.rtm_sessions
  FOR ALL USING (
    public.current_user_role() IN ('super_admin', 'pimpinan')
  )
  WITH CHECK (
    public.current_user_role() IN ('super_admin', 'pimpinan')
  );

-- ── 6. RLS: rtm_findings ──────────────────────────────────────
-- Semua authenticated bisa baca (filter di aplikasi)
DROP POLICY IF EXISTS "rtm_findings: read authenticated" ON public.rtm_findings;
CREATE POLICY "rtm_findings: read authenticated" ON public.rtm_findings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Pimpinan dan super_admin bisa buat/edit keputusan
DROP POLICY IF EXISTS "rtm_findings: pimpinan manage" ON public.rtm_findings;
CREATE POLICY "rtm_findings: pimpinan manage" ON public.rtm_findings
  FOR ALL USING (
    public.current_user_role() IN ('super_admin', 'pimpinan')
  )
  WITH CHECK (
    public.current_user_role() IN ('super_admin', 'pimpinan')
  );

-- ── 7. RLS: rtl_actions (update existing) ────────────────────
-- Auditee: buat/edit RTL untuk unit sendiri
DROP POLICY IF EXISTS "rtl_actions: auditee manage" ON public.rtl_actions;
CREATE POLICY "rtl_actions: auditee manage" ON public.rtl_actions
  FOR ALL
  USING (
    public.current_user_role() = 'super_admin'
    OR (
      public.current_user_role() = 'auditee'
      AND unit_id = public.current_user_unit()
    )
    OR (
      public.current_user_role() IN ('auditor', 'super_admin', 'pimpinan', 'kepala_lpmpp')
    )
    OR public.current_user_is_auditor()
  )
  WITH CHECK (
    public.current_user_role() = 'super_admin'
    OR (
      public.current_user_role() = 'auditee'
      AND unit_id = public.current_user_unit()
    )
    OR public.current_user_role() IN ('auditor', 'pimpinan', 'kepala_lpmpp')
    OR public.current_user_is_auditor()
  );

-- Semua authenticated bisa read RTL
DROP POLICY IF EXISTS "rtl_actions: read authenticated" ON public.rtl_actions;
CREATE POLICY "rtl_actions: read authenticated" ON public.rtl_actions
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── 8. Helper: cek apakah unit dalam scope pimpinan ───────────
CREATE OR REPLACE FUNCTION public.unit_in_pimpinan_scope(p_unit_id UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.units
    WHERE id = p_unit_id
      AND assigned_pimpinan_id = auth.uid()
  );
$$;

-- ── 9. Verifikasi ─────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('rtm_sessions', 'rtm_findings', 'rtl_actions');
