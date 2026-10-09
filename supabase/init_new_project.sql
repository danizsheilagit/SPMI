-- =============================================================================
-- SPMI / QASYS — INITIAL SETUP SCRIPT UNTUK PROJECT SUPABASE BARU
-- =============================================================================
-- File ini menggabungkan seluruh skema (Fase 1 s/d 17) menjadi satu skrip utuh.
-- Jalankan skrip ini sekali di Supabase Dashboard: SQL Editor -> New Query -> Run.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS & ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'auditee',
    'auditor',
    'pimpinan',
    'kepala_lpmpp'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.submission_status AS ENUM (
    'draft',
    'submitted',
    'under_review',
    'revision_needed',
    'verified',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.finding_category AS ENUM (
    'KTS_M',
    'KTS_m',
    'OB',
    'SPT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.rtl_status AS ENUM (
    'open',
    'in_progress',
    'done',
    'verified'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DOMAIN RESTRICTION HELPER
-- ⚙️ Ubah domain jika institusi berubah
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_allowed_email_domain(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  allowed_domain CONSTANT TEXT := 'stikomyos.ac.id';
  user_email TEXT;
  user_domain TEXT;
BEGIN
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN FALSE;
  END IF;
  user_email := LOWER(TRIM(p_email));
  user_domain := SPLIT_PART(user_email, '@', 2);
  RETURN user_domain = allowed_domain OR user_email = 'danizsheila@gmail.com';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CORE TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- 3.1 UNITS
CREATE TABLE IF NOT EXISTS public.units (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  type                 TEXT NOT NULL, -- 'prodi', 'biro', 'upt', 'lembaga'
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_pimpinan_id UUID,          -- FK ke profiles(id) ditambahkan via ALTER di bawah
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 PROFILES (Mirror auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  role          public.user_role NOT NULL DEFAULT 'auditee',
  unit_id       UUID REFERENCES public.units(id) ON DELETE SET NULL,
  unit_name     TEXT,
  is_auditor    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_profiles_email_domain CHECK (public.is_allowed_email_domain(email))
);

-- Tambah FK assigned_pimpinan_id di units setelah profiles dibuat
ALTER TABLE public.units
  DROP CONSTRAINT IF EXISTS fk_units_assigned_pimpinan,
  ADD CONSTRAINT fk_units_assigned_pimpinan
  FOREIGN KEY (assigned_pimpinan_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3.3 AUDIT CYCLES
CREATE TABLE IF NOT EXISTS public.audit_cycles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  semester      TEXT NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.4 INSTRUMENTS
CREATE TABLE IF NOT EXISTS public.instruments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  pdf_storage_path TEXT,
  pdf_uploaded_at  TIMESTAMPTZ,
  pdf_uploaded_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.5 INSTRUMENT COMPONENTS (Butir Rubrik / PPEPP)
CREATE TABLE IF NOT EXISTS public.instrument_components (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  rubric_schema JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.6 UNIT INSTRUMENTS (Mapping Siklus + Unit + Instrumen)
CREATE TABLE IF NOT EXISTS public.unit_instruments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id         UUID NOT NULL REFERENCES public.audit_cycles(id) ON DELETE CASCADE,
  unit_id          UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  instrument_id    UUID NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  assigned_auditor UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cycle_id, unit_id, instrument_id)
);

-- 3.7 MULTI AUDITOR ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.unit_instrument_auditors (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_instrument_id UUID NOT NULL REFERENCES public.unit_instruments(id) ON DELETE CASCADE,
  auditor_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (unit_instrument_id, auditor_id)
);

CREATE INDEX IF NOT EXISTS idx_uia_unit_instrument ON public.unit_instrument_auditors(unit_instrument_id);
CREATE INDEX IF NOT EXISTS idx_uia_auditor         ON public.unit_instrument_auditors(auditor_id);

-- 3.8 SUBMISSIONS (Evaluasi Diri Auditee)
CREATE TABLE IF NOT EXISTS public.submissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_instrument_id UUID NOT NULL REFERENCES public.unit_instruments(id) ON DELETE CASCADE,
  submitted_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status             public.submission_status NOT NULL DEFAULT 'draft',
  answers            JSONB NOT NULL DEFAULT '{}',
  attachments        JSONB NOT NULL DEFAULT '[]',
  submitted_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.9 AUDIT FINDINGS (Temuan & Berita Acara Auditor)
CREATE TABLE IF NOT EXISTS public.audit_findings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  auditor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category       public.finding_category NOT NULL DEFAULT 'OB',
  rubric_results JSONB NOT NULL DEFAULT '{}',
  summary        TEXT,
  recommendation TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.10 STANDARDS
CREATE TABLE IF NOT EXISTS public.standards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             VARCHAR(30) NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  description      TEXT,
  category         VARCHAR(100) NOT NULL DEFAULT 'Umum',
  pdf_storage_path TEXT,
  sort_order       INT NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.11 RTM SESSIONS
CREATE TABLE IF NOT EXISTS public.rtm_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id     UUID NOT NULL UNIQUE REFERENCES public.audit_cycles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  held_at      DATE,
  notes        TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.12 RTM FINDINGS
CREATE TABLE IF NOT EXISTS public.rtm_findings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rtm_id        UUID NOT NULL REFERENCES public.rtm_sessions(id) ON DELETE CASCADE,
  unit_id       UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  component_id  UUID NOT NULL REFERENCES public.instrument_components(id) ON DELETE CASCADE,
  keputusan     TEXT NOT NULL,
  batas_waktu   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rtm_id, unit_id, component_id)
);

-- 3.13 RTL ACTIONS (Rencana Tindak Lanjut)
CREATE TABLE IF NOT EXISTS public.rtl_actions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id     UUID NOT NULL REFERENCES public.audit_findings(id) ON DELETE CASCADE,
  unit_id        UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  assigned_to    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  description    TEXT NOT NULL,
  target_date    DATE,
  status         public.rtl_status NOT NULL DEFAULT 'open',
  evidence_url   TEXT,
  verifier_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at    TIMESTAMPTZ,
  component_id   UUID REFERENCES public.instrument_components(id) ON DELETE SET NULL,
  rtm_finding_id UUID REFERENCES public.rtm_findings(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.14 ANNOUNCEMENTS (Pengumuman)
CREATE TABLE IF NOT EXISTS public.announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  content      TEXT,
  pdf_url      TEXT,
  pdf_name     TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.15 SPMI DOCUMENTS (Pustaka Dokumen SPMI)
CREATE TABLE IF NOT EXISTS public.spmi_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type         TEXT NOT NULL,
  code             TEXT,
  name             TEXT NOT NULL,
  description      TEXT,
  pdf_storage_path TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. UPDATED_AT TRIGGER FUNCTION
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_cycles_updated_at ON public.audit_cycles;
CREATE TRIGGER trg_audit_cycles_updated_at BEFORE UPDATE ON public.audit_cycles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_submissions_updated_at ON public.submissions;
CREATE TRIGGER trg_submissions_updated_at BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_findings_updated_at ON public.audit_findings;
CREATE TRIGGER trg_findings_updated_at BEFORE UPDATE ON public.audit_findings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_rtl_updated_at ON public.rtl_actions;
CREATE TRIGGER trg_rtl_updated_at BEFORE UPDATE ON public.rtl_actions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_standards_updated_at ON public.standards;
CREATE TRIGGER trg_standards_updated_at BEFORE UPDATE ON public.standards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_rtm_sessions_updated_at ON public.rtm_sessions;
CREATE TRIGGER trg_rtm_sessions_updated_at BEFORE UPDATE ON public.rtm_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_rtm_findings_updated_at ON public.rtm_findings;
CREATE TRIGGER trg_rtm_findings_updated_at BEFORE UPDATE ON public.rtm_findings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_spmi_documents_updated_at ON public.spmi_documents;
CREATE TRIGGER trg_spmi_documents_updated_at BEFORE UPDATE ON public.spmi_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. AUTH & HELPER FUNCTIONS (SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────────────────────

-- 5.1 Trigger auto-insert profile saat ada user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_domain CONSTANT TEXT := 'stikomyos.ac.id';
  user_email TEXT;
  user_domain TEXT;
BEGIN
  user_email := LOWER(TRIM(NEW.email));
  user_domain := SPLIT_PART(user_email, '@', 2);

  IF user_domain <> allowed_domain AND user_email <> 'danizsheila@gmail.com' THEN
    RAISE EXCEPTION
      'Akses ditolak: Domain email % tidak diizinkan. Gunakan akun @%',
      user_domain, allowed_domain
      USING ERRCODE = 'P0001';
  END IF;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5.2 Get Current User Profile (bypass RLS tanpa loop)
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS JSON
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

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO anon, authenticated;

-- 5.3 Helper Role & Unit Check
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT role::TEXT FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_unit()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT unit_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_auditor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT is_auditor FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_lpmpp()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'kepala_lpmpp')
  );
$$;

-- 5.4 User Management Functions
CREATE OR REPLACE FUNCTION public.get_all_profiles()
RETURNS TABLE(
  id          UUID,
  email       TEXT,
  full_name   TEXT,
  avatar_url  TEXT,
  role        TEXT,
  unit_id     UUID,
  unit_name   TEXT,
  is_auditor  BOOLEAN,
  created_at  TIMESTAMPTZ
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

CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_user_id   UUID,
  p_role      TEXT,
  p_unit_id   UUID DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL
)
RETURNS VOID
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

GRANT EXECUTE ON FUNCTION public.update_user_profile(UUID, TEXT, UUID, TEXT) TO authenticated;

-- 5.5 Dashboard & Activity Stats
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT json_build_object(
    'total_instruments',    (SELECT COUNT(*) FROM public.instruments  WHERE is_active = TRUE),
    'total_units',          (SELECT COUNT(*) FROM public.units        WHERE is_active = TRUE),
    'total_users',          (SELECT COUNT(*) FROM public.profiles),
    'active_cycle_name',    (SELECT name     FROM public.audit_cycles WHERE is_active = TRUE LIMIT 1),
    'total_submissions',    (SELECT COUNT(*) FROM public.submissions),
    'pending_review',       (SELECT COUNT(*) FROM public.submissions  WHERE status IN ('submitted','under_review')),
    'open_findings',        (SELECT COUNT(*) FROM public.audit_findings),
    'verified_submissions', (SELECT COUNT(*) FROM public.submissions  WHERE status = 'verified')
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_recent_user_activity(p_limit INT DEFAULT 10)
RETURNS TABLE(
  id              UUID,
  email           TEXT,
  full_name       TEXT,
  avatar_url      TEXT,
  role            TEXT,
  last_sign_in_at TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ
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
    p.role::TEXT,
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

GRANT EXECUTE ON FUNCTION public.get_recent_user_activity(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_recent_assignments(p_limit INT DEFAULT 5)
RETURNS TABLE(
  id              UUID,
  unit_name       TEXT,
  instrument_name TEXT,
  cycle_name      TEXT,
  created_at      TIMESTAMPTZ
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

GRANT EXECUTE ON FUNCTION public.get_recent_assignments(INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_cycles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrument_components    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_instruments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_instrument_auditors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_findings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standards                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rtm_sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rtm_findings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rtl_actions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spmi_documents           ENABLE ROW LEVEL SECURITY;

-- 6.1 profiles
DROP POLICY IF EXISTS "profiles: select own" ON public.profiles;
CREATE POLICY "profiles: select own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles: insert via trigger" ON public.profiles;
CREATE POLICY "profiles: insert via trigger" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;
CREATE POLICY "profiles: update own" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 6.2 units
DROP POLICY IF EXISTS "units: read all authenticated" ON public.units;
CREATE POLICY "units: read all authenticated" ON public.units
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "units: write super_admin" ON public.units;
CREATE POLICY "units: write super_admin" ON public.units
  FOR ALL USING (public.current_user_role() = 'super_admin');

-- 6.3 audit_cycles
DROP POLICY IF EXISTS "cycles: all roles read" ON public.audit_cycles;
CREATE POLICY "cycles: all roles read" ON public.audit_cycles
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "cycles: super_admin write" ON public.audit_cycles;
CREATE POLICY "cycles: super_admin write" ON public.audit_cycles
  FOR ALL USING (public.current_user_role() = 'super_admin');

-- 6.4 instruments
DROP POLICY IF EXISTS "instruments: read all authenticated" ON public.instruments;
CREATE POLICY "instruments: read all authenticated" ON public.instruments
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "instruments: write super_admin" ON public.instruments;
CREATE POLICY "instruments: write super_admin" ON public.instruments
  FOR ALL USING (public.current_user_role() = 'super_admin');

-- 6.5 instrument_components
DROP POLICY IF EXISTS "components: read all authenticated" ON public.instrument_components;
CREATE POLICY "components: read all authenticated" ON public.instrument_components
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "components: write super_admin" ON public.instrument_components;
CREATE POLICY "components: write super_admin" ON public.instrument_components
  FOR ALL USING (public.current_user_role() = 'super_admin');

-- 6.6 unit_instruments
DROP POLICY IF EXISTS "unit_instruments: read authenticated" ON public.unit_instruments;
CREATE POLICY "unit_instruments: read authenticated" ON public.unit_instruments
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "unit_instruments: write super_admin" ON public.unit_instruments;
CREATE POLICY "unit_instruments: write super_admin" ON public.unit_instruments
  FOR ALL USING (public.current_user_role() = 'super_admin');

-- 6.7 unit_instrument_auditors
DROP POLICY IF EXISTS "uia: super_admin full" ON public.unit_instrument_auditors;
CREATE POLICY "uia: super_admin full" ON public.unit_instrument_auditors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "uia: authenticated read" ON public.unit_instrument_auditors;
CREATE POLICY "uia: authenticated read" ON public.unit_instrument_auditors
  FOR SELECT USING (auth.role() = 'authenticated');

-- 6.8 submissions
DROP POLICY IF EXISTS "submissions: read access" ON public.submissions;
CREATE POLICY "submissions: read access" ON public.submissions
  FOR SELECT USING (
    public.current_user_role() IN ('super_admin', 'pimpinan')
    OR (
      (public.current_user_role() = 'auditor' OR public.current_user_is_auditor())
      AND EXISTS (
        SELECT 1 FROM public.unit_instrument_auditors uia
        WHERE uia.unit_instrument_id = submissions.unit_instrument_id
          AND uia.auditor_id = auth.uid()
      )
    )
    OR (
      public.current_user_role() = 'auditee'
      AND EXISTS (
        SELECT 1 FROM public.unit_instruments ui
        WHERE ui.id = submissions.unit_instrument_id
          AND ui.unit_id = public.current_user_unit()
      )
    )
  );

DROP POLICY IF EXISTS "submissions: insert auditee or admin" ON public.submissions;
CREATE POLICY "submissions: insert auditee or admin" ON public.submissions
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

DROP POLICY IF EXISTS "submissions: update access" ON public.submissions;
CREATE POLICY "submissions: update access" ON public.submissions
  FOR UPDATE
  USING (
    public.current_user_role() = 'super_admin'
    OR (
      (public.current_user_role() = 'auditor' OR public.current_user_is_auditor())
      AND EXISTS (
        SELECT 1 FROM public.unit_instrument_auditors uia
        WHERE uia.unit_instrument_id = submissions.unit_instrument_id
          AND uia.auditor_id = auth.uid()
      )
    )
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
  WITH CHECK (
    public.current_user_role() = 'super_admin'
    OR (
      (public.current_user_role() = 'auditor' OR public.current_user_is_auditor())
      AND EXISTS (
        SELECT 1 FROM public.unit_instrument_auditors uia
        WHERE uia.unit_instrument_id = submissions.unit_instrument_id
          AND uia.auditor_id = auth.uid()
      )
    )
    OR (
      public.current_user_role() = 'auditee'
      AND EXISTS (
        SELECT 1 FROM public.unit_instruments ui
        WHERE ui.id = submissions.unit_instrument_id
          AND ui.unit_id = public.current_user_unit()
      )
    )
  );

-- 6.9 audit_findings
DROP POLICY IF EXISTS "findings: read authenticated" ON public.audit_findings;
CREATE POLICY "findings: read authenticated" ON public.audit_findings
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "findings: write auditor or super_admin" ON public.audit_findings;
CREATE POLICY "findings: write auditor or super_admin" ON public.audit_findings
  FOR ALL USING (
    public.current_user_role() IN ('super_admin', 'auditor')
    OR public.current_user_is_auditor()
  );

-- 6.10 standards
DROP POLICY IF EXISTS "standards: authenticated can read" ON public.standards;
CREATE POLICY "standards: authenticated can read" ON public.standards
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);

DROP POLICY IF EXISTS "standards: super_admin full access" ON public.standards;
CREATE POLICY "standards: super_admin full access" ON public.standards
  FOR ALL USING (public.is_admin_or_lpmpp());

-- 6.11 rtm_sessions
DROP POLICY IF EXISTS "rtm_sessions: read authenticated" ON public.rtm_sessions;
CREATE POLICY "rtm_sessions: read authenticated" ON public.rtm_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "rtm_sessions: pimpinan manage" ON public.rtm_sessions;
CREATE POLICY "rtm_sessions: pimpinan manage" ON public.rtm_sessions
  FOR ALL USING (public.current_user_role() IN ('super_admin', 'pimpinan'))
  WITH CHECK (public.current_user_role() IN ('super_admin', 'pimpinan'));

-- 6.12 rtm_findings
DROP POLICY IF EXISTS "rtm_findings: read authenticated" ON public.rtm_findings;
CREATE POLICY "rtm_findings: read authenticated" ON public.rtm_findings
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "rtm_findings: pimpinan manage" ON public.rtm_findings;
CREATE POLICY "rtm_findings: pimpinan manage" ON public.rtm_findings
  FOR ALL USING (public.current_user_role() IN ('super_admin', 'pimpinan'))
  WITH CHECK (public.current_user_role() IN ('super_admin', 'pimpinan'));

-- 6.13 rtl_actions
DROP POLICY IF EXISTS "rtl: read authenticated" ON public.rtl_actions;
CREATE POLICY "rtl: read authenticated" ON public.rtl_actions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "rtl: auditee write own unit" ON public.rtl_actions;
CREATE POLICY "rtl: auditee write own unit" ON public.rtl_actions
  FOR INSERT WITH CHECK (
    public.current_user_role() = 'super_admin'
    OR (
      public.current_user_role() = 'auditee'
      AND unit_id = public.current_user_unit()
    )
  );

DROP POLICY IF EXISTS "rtl: update access" ON public.rtl_actions;
CREATE POLICY "rtl: update access" ON public.rtl_actions
  FOR UPDATE USING (
    public.current_user_role() = 'super_admin'
    OR (
      public.current_user_role() = 'auditee'
      AND unit_id = public.current_user_unit()
    )
  );

-- 6.14 announcements
DROP POLICY IF EXISTS "announcements: admin manage" ON public.announcements;
CREATE POLICY "announcements: admin manage" ON public.announcements
  FOR ALL USING (public.is_admin_or_lpmpp()) WITH CHECK (public.is_admin_or_lpmpp());

DROP POLICY IF EXISTS "announcements: read active" ON public.announcements;
CREATE POLICY "announcements: read active" ON public.announcements
  FOR SELECT USING (is_active = TRUE AND auth.uid() IS NOT NULL);

-- 6.15 spmi_documents
DROP POLICY IF EXISTS "spmi_docs: admin manage" ON public.spmi_documents;
CREATE POLICY "spmi_docs: admin manage" ON public.spmi_documents
  FOR ALL USING (public.is_admin_or_lpmpp()) WITH CHECK (public.is_admin_or_lpmpp());

DROP POLICY IF EXISTS "spmi_docs: read active" ON public.spmi_documents;
CREATE POLICY "spmi_docs: read active" ON public.spmi_documents
  FOR SELECT USING (is_active = TRUE AND auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. STORAGE BUCKETS & POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

-- 7.1 Create Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('instrument-pdfs', 'instrument-pdfs', TRUE, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = TRUE;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence-files', 'evidence-files', FALSE, 52428800,
  ARRAY['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

INSERT INTO storage.buckets (id, name, public)
VALUES ('standard-docs', 'standard-docs', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

INSERT INTO storage.buckets (id, name, public)
VALUES ('announcements', 'announcements', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

INSERT INTO storage.buckets (id, name, public)
VALUES ('dokumen-spmi', 'dokumen-spmi', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

-- 7.2 Storage RLS Policies: instrument-pdfs
DROP POLICY IF EXISTS "instrument-pdfs: public read" ON storage.objects;
CREATE POLICY "instrument-pdfs: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'instrument-pdfs');

DROP POLICY IF EXISTS "instrument-pdfs: super_admin write" ON storage.objects;
CREATE POLICY "instrument-pdfs: super_admin write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'instrument-pdfs' AND public.is_admin_or_lpmpp());

DROP POLICY IF EXISTS "instrument-pdfs: super_admin update" ON storage.objects;
CREATE POLICY "instrument-pdfs: super_admin update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'instrument-pdfs' AND public.is_admin_or_lpmpp());

DROP POLICY IF EXISTS "instrument-pdfs: super_admin delete" ON storage.objects;
CREATE POLICY "instrument-pdfs: super_admin delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'instrument-pdfs' AND public.is_admin_or_lpmpp());

-- 7.3 Storage RLS Policies: evidence-files
DROP POLICY IF EXISTS "evidence-files: authenticated read" ON storage.objects;
CREATE POLICY "evidence-files: authenticated read" ON storage.objects
  FOR SELECT USING (bucket_id = 'evidence-files' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "evidence-files: auditee upload" ON storage.objects;
CREATE POLICY "evidence-files: auditee upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'evidence-files' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "evidence-files: auditee delete" ON storage.objects;
CREATE POLICY "evidence-files: auditee delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'evidence-files' AND auth.role() = 'authenticated');

-- 7.4 Storage RLS Policies: standard-docs
DROP POLICY IF EXISTS "standard-docs: authenticated read" ON storage.objects;
CREATE POLICY "standard-docs: authenticated read" ON storage.objects
  FOR SELECT USING (bucket_id = 'standard-docs' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "standard-docs: super_admin write" ON storage.objects;
CREATE POLICY "standard-docs: super_admin write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'standard-docs' AND public.is_admin_or_lpmpp());

DROP POLICY IF EXISTS "standard-docs: super_admin delete" ON storage.objects;
CREATE POLICY "standard-docs: super_admin delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'standard-docs' AND public.is_admin_or_lpmpp());

-- 7.5 Storage RLS Policies: announcements
DROP POLICY IF EXISTS "announcements storage: public read" ON storage.objects;
CREATE POLICY "announcements storage: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'announcements');

DROP POLICY IF EXISTS "announcements storage: admin insert" ON storage.objects;
CREATE POLICY "announcements storage: admin insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'announcements' AND public.is_admin_or_lpmpp());

DROP POLICY IF EXISTS "announcements storage: admin update" ON storage.objects;
CREATE POLICY "announcements storage: admin update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'announcements' AND public.is_admin_or_lpmpp());

DROP POLICY IF EXISTS "announcements storage: admin delete" ON storage.objects;
CREATE POLICY "announcements storage: admin delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'announcements' AND public.is_admin_or_lpmpp());

-- 7.6 Storage RLS Policies: dokumen-spmi
DROP POLICY IF EXISTS "dokumen-spmi: auth read" ON storage.objects;
CREATE POLICY "dokumen-spmi: auth read" ON storage.objects
  FOR SELECT USING (bucket_id = 'dokumen-spmi' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "dokumen-spmi: admin upload" ON storage.objects;
CREATE POLICY "dokumen-spmi: admin upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'dokumen-spmi' AND public.is_admin_or_lpmpp());

DROP POLICY IF EXISTS "dokumen-spmi: admin update" ON storage.objects;
CREATE POLICY "dokumen-spmi: admin update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'dokumen-spmi' AND public.is_admin_or_lpmpp());

DROP POLICY IF EXISTS "dokumen-spmi: admin delete" ON storage.objects;
CREATE POLICY "dokumen-spmi: admin delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'dokumen-spmi' AND public.is_admin_or_lpmpp());

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. INITIAL SEED DATA
-- ─────────────────────────────────────────────────────────────────────────────

-- 8.1 Seed Units
INSERT INTO public.units (code, name, type) VALUES
  ('PRODI-DKV',  'Prodi Desain Komunikasi Visual', 'prodi'),
  ('PRODI-TI',   'Prodi Teknik Informatika',        'prodi'),
  ('PRODI-SI',   'Prodi Sistem Informasi',           'prodi'),
  ('BIRO-KEU',   'Biro Keuangan',                   'biro'),
  ('BAAK',       'BAAK',                             'biro'),
  ('BIRO-ADM',   'Biro Administrasi Umum',           'biro'),
  ('UPT-HUMAS',  'UPT Humas',                       'upt'),
  ('UPT-LAB',    'UPT Laboratorium',                'upt'),
  ('UPT-PERPUS', 'UPT Perpustakaan',                'upt'),
  ('UPT-PMB',    'UPT PMB',                         'upt')
ON CONFLICT (code) DO NOTHING;

-- 8.2 Seed Instruments
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
  ('INST-11', 'UPT PMB')
ON CONFLICT (code) DO NOTHING;

-- 8.3 Seed Components for INST-01
INSERT INTO public.instrument_components
  (instrument_id, code, name, description, sort_order, rubric_schema)
SELECT id, 'S1.B1', 'Standar Kompetensi Lulusan',
  'Evaluasi penetapan dan pemenuhan capaian pembelajaran lulusan (CPL)', 1,
  '{"ppepp":{"penetapan":{"deskripsi":"Dokumen CPL telah ditetapkan dan disahkan"},"pelaksanaan":{"deskripsi":"CPL diimplementasikan dalam kurikulum"},"evaluasi":{"deskripsi":"Evaluasi pencapaian CPL dilakukan secara berkala"},"pengendalian":{"deskripsi":"Mekanisme pengendalian CPL berjalan"},"peningkatan":{"deskripsi":"Ada bukti tindak lanjut peningkatan CPL"}},"max_score":5}'::jsonb
FROM public.instruments WHERE code = 'INST-01'
ON CONFLICT DO NOTHING;

INSERT INTO public.instrument_components
  (instrument_id, code, name, description, sort_order, rubric_schema)
SELECT id, 'S1.B2', 'Standar Isi Pembelajaran',
  'Evaluasi kedalaman dan keluasan materi pembelajaran', 2,
  '{"ppepp":{"penetapan":{"deskripsi":"Kurikulum dan RPS telah ditetapkan"},"pelaksanaan":{"deskripsi":"Pembelajaran dilaksanakan sesuai RPS"},"evaluasi":{"deskripsi":"Evaluasi kesesuaian isi pembelajaran"},"pengendalian":{"deskripsi":"Pengendalian kualitas isi pembelajaran"},"peningkatan":{"deskripsi":"Pembaruan kurikulum berdasarkan evaluasi"}},"max_score":5}'::jsonb
FROM public.instruments WHERE code = 'INST-01'
ON CONFLICT DO NOTHING;

INSERT INTO public.instrument_components
  (instrument_id, code, name, description, sort_order, rubric_schema)
SELECT id, 'S1.B3', 'Standar Proses Pembelajaran',
  'Evaluasi karakteristik, perencanaan, pelaksanaan proses pembelajaran', 3,
  '{"ppepp":{"penetapan":{"deskripsi":"SOP proses pembelajaran ditetapkan"},"pelaksanaan":{"deskripsi":"Proses pembelajaran berjalan sesuai SOP"},"evaluasi":{"deskripsi":"Evaluasi proses pembelajaran"},"pengendalian":{"deskripsi":"Pengendalian mutu proses pembelajaran"},"peningkatan":{"deskripsi":"Peningkatan metode pembelajaran"}},"max_score":5}'::jsonb
FROM public.instruments WHERE code = 'INST-01'
ON CONFLICT DO NOTHING;

INSERT INTO public.instrument_components
  (instrument_id, code, name, description, sort_order, rubric_schema)
SELECT id, 'S1.B4', 'Standar Penilaian Pembelajaran',
  'Evaluasi mekanisme dan instrumen penilaian', 4,
  '{"ppepp":{"penetapan":{"deskripsi":"Kebijakan penilaian ditetapkan"},"pelaksanaan":{"deskripsi":"Penilaian dilaksanakan sesuai kebijakan"},"evaluasi":{"deskripsi":"Evaluasi instrumen penilaian"},"pengendalian":{"deskripsi":"Pengendalian konsistensi penilaian"},"peningkatan":{"deskripsi":"Peningkatan sistem penilaian"}},"max_score":5}'::jsonb
FROM public.instruments WHERE code = 'INST-01'
ON CONFLICT DO NOTHING;

INSERT INTO public.instrument_components
  (instrument_id, code, name, description, sort_order, rubric_schema)
SELECT id, 'S1.B5', 'Standar Dosen dan Tenaga Kependidikan',
  'Evaluasi kualifikasi dan kinerja dosen', 5,
  '{"ppepp":{"penetapan":{"deskripsi":"Standar kualifikasi dosen ditetapkan"},"pelaksanaan":{"deskripsi":"Rekrutmen dan pengembangan dosen berjalan"},"evaluasi":{"deskripsi":"Evaluasi kinerja dosen"},"pengendalian":{"deskripsi":"Pengendalian kualitas SDM"},"peningkatan":{"deskripsi":"Peningkatan kompetensi dosen"}},"max_score":5}'::jsonb
FROM public.instruments WHERE code = 'INST-01'
ON CONFLICT DO NOTHING;

-- 8.4 Seed Standards
INSERT INTO public.standards (code, name, category, description, sort_order) VALUES
  ('SN-01', 'SN-Dikti: Standar Kompetensi Lulusan',    'Pendidikan',  'Permendikbudristek No. 53 Tahun 2023 tentang Penjaminan Mutu Pendidikan Tinggi', 1),
  ('SN-02', 'SN-Dikti: Standar Isi Pembelajaran',       'Pendidikan',  'Standar isi pembelajaran sesuai SN-Dikti', 2),
  ('SN-03', 'SN-Dikti: Standar Proses Pembelajaran',    'Pendidikan',  'Standar proses pembelajaran sesuai SN-Dikti', 3),
  ('SN-04', 'SN-Dikti: Standar Penilaian Pembelajaran', 'Pendidikan',  'Standar penilaian pembelajaran sesuai SN-Dikti', 4),
  ('SN-05', 'SN-Dikti: Standar Penelitian',             'Penelitian',  'Standar penelitian sesuai SN-Dikti', 5),
  ('SN-06', 'SN-Dikti: Standar PKM',                    'PKM',         'Standar pengabdian kepada masyarakat sesuai SN-Dikti', 6)
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- SELESAI! Setup Database & Storage SPMI Siap Digunakan.
-- =============================================================================
