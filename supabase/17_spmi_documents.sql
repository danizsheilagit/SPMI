-- ================================================================
-- QASYS Migration 17 — Dokumen SPMI Library
-- Tabel generik untuk semua jenis dokumen SPMI & Pendukung
-- ================================================================

CREATE TABLE IF NOT EXISTS public.spmi_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type         TEXT NOT NULL,   -- kebijakan | manual | standar_spmi | instrumen_spmi | sop
                                    -- pendidikan | penelitian | pengabdian | non_sndikti
  code             TEXT,
  name             TEXT NOT NULL,
  description      TEXT,
  pdf_storage_path TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_by       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.spmi_documents ENABLE ROW LEVEL SECURITY;

-- RLS: Super Admin + Kepala LPMPP bisa CRUD
DROP POLICY IF EXISTS "spmi_docs: admin manage" ON public.spmi_documents;
CREATE POLICY "spmi_docs: admin manage" ON public.spmi_documents
  FOR ALL
  USING      ( public.is_admin_or_lpmpp() )
  WITH CHECK ( public.is_admin_or_lpmpp() );

-- Semua authenticated bisa baca dokumen aktif
DROP POLICY IF EXISTS "spmi_docs: read active" ON public.spmi_documents;
CREATE POLICY "spmi_docs: read active" ON public.spmi_documents
  FOR SELECT
  USING ( is_active = true AND auth.uid() IS NOT NULL );

-- Bucket storage dokumen-spmi (jalankan jika belum ada)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dokumen-spmi', 'dokumen-spmi', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "dokumen-spmi: admin upload"  ON storage.objects;
DROP POLICY IF EXISTS "dokumen-spmi: auth read"     ON storage.objects;
DROP POLICY IF EXISTS "dokumen-spmi: admin delete"  ON storage.objects;

CREATE POLICY "dokumen-spmi: admin upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'dokumen-spmi' AND public.is_admin_or_lpmpp()
  );

CREATE POLICY "dokumen-spmi: auth read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'dokumen-spmi' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "dokumen-spmi: admin delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'dokumen-spmi' AND public.is_admin_or_lpmpp()
  );

CREATE POLICY "dokumen-spmi: admin update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'dokumen-spmi' AND public.is_admin_or_lpmpp()
  );

SELECT COUNT(*) AS spmi_documents_table FROM public.spmi_documents;
