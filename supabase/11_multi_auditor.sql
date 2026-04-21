-- ================================================================
-- QASYS — Multi-Auditor per Unit Instrument
-- Tabel junction: unit_instrument_auditors
-- ================================================================

CREATE TABLE IF NOT EXISTS public.unit_instrument_auditors (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_instrument_id UUID        NOT NULL REFERENCES public.unit_instruments(id) ON DELETE CASCADE,
  auditor_id         UUID        NOT NULL REFERENCES public.profiles(id)          ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_instrument_id, auditor_id)
);

-- Index untuk query cepat
CREATE INDEX IF NOT EXISTS idx_uia_unit_instrument ON public.unit_instrument_auditors(unit_instrument_id);
CREATE INDEX IF NOT EXISTS idx_uia_auditor         ON public.unit_instrument_auditors(auditor_id);

-- RLS: Super Admin bisa CRUD, user bisa SELECT auditor yang ditugaskan ke mereka
ALTER TABLE public.unit_instrument_auditors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uia: super_admin full" ON public.unit_instrument_auditors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "uia: authenticated read" ON public.unit_instrument_auditors
  FOR SELECT USING (auth.role() = 'authenticated');

-- Verifikasi
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'unit_instrument_auditors';
