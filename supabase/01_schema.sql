-- =============================================================
-- QASYS — Skrip SQL Fase 1
-- Inisialisasi Database Supabase untuk Sistem SPMI
-- Jalankan di Query Editor Supabase >> SQL Editor
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. ENUM TYPES
-- ─────────────────────────────────────────────────────────────
CREATE TYPE public.user_role AS ENUM (
  'super_admin',  -- Kepala SPMI
  'auditee',      -- Unit / Prodi
  'auditor',
  'pimpinan'
);

CREATE TYPE public.submission_status AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'revision_needed',
  'verified',
  'closed'
);

CREATE TYPE public.finding_category AS ENUM (
  'KTS_M',   -- Ketidaksesuaian Mayor
  'KTS_m',   -- Ketidaksesuaian Minor
  'OB',      -- Observasi
  'SPT'      -- Saran Perbaikan
);

CREATE TYPE public.rtl_status AS ENUM (
  'open',
  'in_progress',
  'done',
  'verified'
);

-- ─────────────────────────────────────────────────────────────
-- 1. PROFILES
-- Mirror of auth.users — extended with role & unit info
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  role          public.user_role NOT NULL DEFAULT 'auditee',
  unit_id       UUID,              -- FK to units table (added after)
  unit_name     TEXT,              -- Denormalized for display speed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-upsert profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. AUDIT CYCLES
-- Represents a single AMI cycle (e.g., "AMI 2026 Semester Ganjil")
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.audit_cycles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,                    -- e.g. "AMI 2026 Semester Ganjil"
  academic_year TEXT NOT NULL,                    -- e.g. "2025/2026"
  semester      TEXT NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 3. INSTRUMENTS
-- 11 instrument types — stored as master data
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.instruments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE, -- e.g. INST-01
  name        TEXT NOT NULL,        -- e.g. "Pendidikan"
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed 11 instruments
INSERT INTO public.instruments (code, name) VALUES
  ('INST-01', 'Pendidikan'),
  ('INST-02', 'Penelitian'),
  ('INST-03', 'Pengabdian kepada Masyarakat'),
  ('INST-04', 'Keuangan'),
  ('INST-05', 'BAAK'),
  ('INST-06', 'Biro Administrasi'),
  ('INST-07', 'Administrasi Umum'),
  ('INST-08', 'UPT Humas'),
  ('INST-09', 'UPT Laboratorium'),
  ('INST-10', 'UPT Perpustakaan'),
  ('INST-11', 'UPT PMB');

-- ─────────────────────────────────────────────────────────────
-- 4. INSTRUMENT COMPONENTS (Butir Penilaian / Standar)
-- Each instrument has multiple assessment items/standards.
-- `rubric_schema` (JSONB) defines the dynamic form structure.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.instrument_components (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id   UUID NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,         -- e.g. "S1.B1" (Standar 1, Butir 1)
  name            TEXT NOT NULL,
  description     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  -- JSONB: defines fields, scoring criteria, max_score, etc.
  rubric_schema   JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 5. UNITS
-- Units/Programs that are subject to auditing
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,  -- e.g. 'prodi', 'biro', 'upt', 'lembaga'
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 6. UNIT INSTRUMENTS (mapping: siklus + unit + instrument)
-- Determines which instrument applies to which unit in a cycle.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.unit_instruments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        UUID NOT NULL REFERENCES public.audit_cycles(id) ON DELETE CASCADE,
  unit_id         UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  instrument_id   UUID NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  assigned_auditor UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cycle_id, unit_id, instrument_id)
);

-- ─────────────────────────────────────────────────────────────
-- 7. SUBMISSIONS (Evaluasi Diri / LKPS)
-- One submission per unit_instrument mapping.
-- `answers` (JSONB) holds the dynamic form data from the auditee.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.submissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_instrument_id  UUID NOT NULL REFERENCES public.unit_instruments(id) ON DELETE CASCADE,
  submitted_by        UUID REFERENCES public.profiles(id),
  status              public.submission_status NOT NULL DEFAULT 'draft',
  -- Dynamic payload: {component_id: {field: value, ...}, ...}
  answers             JSONB NOT NULL DEFAULT '{}',
  -- Supporting document URLs (Supabase Storage paths)
  attachments         JSONB NOT NULL DEFAULT '[]',
  submitted_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 8. AUDIT FINDINGS (Berita Acara / Temuan)
-- One finding record per submission audit visit.
-- `rubric_results` (JSONB) holds per-component scoring by auditor.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.audit_findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  auditor_id      UUID REFERENCES public.profiles(id),
  category        public.finding_category NOT NULL DEFAULT 'OB',
  -- JSONB: {component_id: {score, notes, evidence_url}, ...}
  rubric_results  JSONB NOT NULL DEFAULT '{}',
  summary         TEXT,
  recommendation  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 9. RTL ACTIONS (Rencana Tindak Lanjut)
-- Action plans by auditee in response to findings.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.rtl_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id      UUID NOT NULL REFERENCES public.audit_findings(id) ON DELETE CASCADE,
  unit_id         UUID NOT NULL REFERENCES public.units(id),
  assigned_to     UUID REFERENCES public.profiles(id),
  description     TEXT NOT NULL,
  target_date     DATE,
  status          public.rtl_status NOT NULL DEFAULT 'open',
  -- Evidence of completion
  evidence_url    TEXT,
  verifier_id     UUID REFERENCES public.profiles(id),
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 10. FOREIGN KEY: profiles.unit_id -> units.id
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_unit
  FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- 11. UPDATED_AT TRIGGERS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at     BEFORE UPDATE ON public.profiles     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_cycles_updated_at BEFORE UPDATE ON public.audit_cycles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_submissions_updated_at  BEFORE UPDATE ON public.submissions  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_findings_updated_at     BEFORE UPDATE ON public.audit_findings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rtl_updated_at          BEFORE UPDATE ON public.rtl_actions  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 12. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_cycles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrument_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_instruments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_findings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rtl_actions        ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT role::TEXT FROM public.profiles WHERE id = auth.uid();
$$;

-- Helper: get current user unit_id
CREATE OR REPLACE FUNCTION public.current_user_unit()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT unit_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ── profiles ──────────────────────────────────────────────────
-- Users can read own profile; super_admin reads all
CREATE POLICY "profiles: select own or super_admin" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR public.current_user_role() = 'super_admin'
  );

CREATE POLICY "profiles: update own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- ── audit_cycles ─────────────────────────────────────────────
CREATE POLICY "cycles: all roles read" ON public.audit_cycles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "cycles: super_admin write" ON public.audit_cycles
  FOR ALL USING (public.current_user_role() = 'super_admin');

-- ── instruments ──────────────────────────────────────────────
CREATE POLICY "instruments: read all authenticated" ON public.instruments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "instruments: write super_admin" ON public.instruments
  FOR ALL USING (public.current_user_role() = 'super_admin');

-- ── instrument_components ────────────────────────────────────
CREATE POLICY "components: read all authenticated" ON public.instrument_components
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "components: write super_admin" ON public.instrument_components
  FOR ALL USING (public.current_user_role() = 'super_admin');

-- ── units ────────────────────────────────────────────────────
CREATE POLICY "units: read all authenticated" ON public.units
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "units: write super_admin" ON public.units
  FOR ALL USING (public.current_user_role() = 'super_admin');

-- ── unit_instruments ─────────────────────────────────────────
CREATE POLICY "unit_instruments: read authenticated" ON public.unit_instruments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "unit_instruments: write super_admin" ON public.unit_instruments
  FOR ALL USING (public.current_user_role() = 'super_admin');

-- ── submissions ──────────────────────────────────────────────
-- Auditee: can read/write own unit submissions only
CREATE POLICY "submissions: auditee read own unit" ON public.submissions
  FOR SELECT USING (
    public.current_user_role() = 'super_admin'
    OR public.current_user_role() IN ('auditor', 'pimpinan')
    OR (
      public.current_user_role() = 'auditee'
      AND EXISTS (
        SELECT 1 FROM public.unit_instruments ui
        WHERE ui.id = submissions.unit_instrument_id
          AND ui.unit_id = public.current_user_unit()
      )
    )
  );

CREATE POLICY "submissions: auditee write own unit" ON public.submissions
  FOR INSERT WITH CHECK (
    public.current_user_role() = 'super_admin'
    OR (
      public.current_user_role() = 'auditee'
      AND EXISTS (
        SELECT 1 FROM public.unit_instruments ui
        WHERE ui.id = unit_instrument_id
          AND ui.unit_id = public.current_user_unit()
      )
    )
  );

CREATE POLICY "submissions: auditee update own unit" ON public.submissions
  FOR UPDATE USING (
    public.current_user_role() = 'super_admin'
    OR (
      public.current_user_role() = 'auditee'
      AND status IN ('draft', 'revision_needed')
      AND EXISTS (
        SELECT 1 FROM public.unit_instruments ui
        WHERE ui.id = submissions.unit_instrument_id
          AND ui.unit_id = public.current_user_unit()
      )
    )
  );

-- ── audit_findings ───────────────────────────────────────────
CREATE POLICY "findings: read authenticated" ON public.audit_findings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "findings: write auditor or super_admin" ON public.audit_findings
  FOR ALL USING (
    public.current_user_role() IN ('super_admin', 'auditor')
  );

-- ── rtl_actions ───────────────────────────────────────────────
CREATE POLICY "rtl: read authenticated" ON public.rtl_actions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "rtl: auditee write own unit" ON public.rtl_actions
  FOR INSERT WITH CHECK (
    public.current_user_role() = 'super_admin'
    OR (
      public.current_user_role() = 'auditee'
      AND unit_id = public.current_user_unit()
    )
  );

CREATE POLICY "rtl: auditee update own unit" ON public.rtl_actions
  FOR UPDATE USING (
    public.current_user_role() = 'super_admin'
    OR (
      public.current_user_role() = 'auditee'
      AND unit_id = public.current_user_unit()
    )
  );

CREATE POLICY "rtl: super_admin verify" ON public.rtl_actions
  FOR UPDATE USING (public.current_user_role() = 'super_admin');

-- ─────────────────────────────────────────────────────────────
-- SELESAI
-- ─────────────────────────────────────────────────────────────
