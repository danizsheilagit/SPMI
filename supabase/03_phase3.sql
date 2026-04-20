-- =============================================================
-- QASYS — Fase 3: Storage + Seed Data + Instrument Updates
-- Jalankan di Supabase SQL Editor
-- TIPS: Jalankan bagian per bagian jika ada error
-- =============================================================

-- ── 1. Tambah kolom PDF ke tabel instruments ──────────────────
ALTER TABLE public.instruments
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_uploaded_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdf_uploaded_by  UUID REFERENCES public.profiles(id);

-- ── 2. Buat Storage Buckets ───────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('instrument-pdfs', 'instrument-pdfs', TRUE, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('evidence-files', 'evidence-files', FALSE, 52428800,
  ARRAY['application/pdf','image/jpeg','image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- ── 3. RLS Storage: instrument-pdfs ──────────────────────────
CREATE POLICY "instrument-pdfs: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'instrument-pdfs');

CREATE POLICY "instrument-pdfs: super_admin write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'instrument-pdfs'
    AND public.current_user_role() = 'super_admin'
  );

CREATE POLICY "instrument-pdfs: super_admin delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'instrument-pdfs'
    AND public.current_user_role() = 'super_admin'
  );

CREATE POLICY "instrument-pdfs: super_admin update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'instrument-pdfs'
    AND public.current_user_role() = 'super_admin'
  );

-- ── 4. RLS Storage: evidence-files ───────────────────────────
CREATE POLICY "evidence-files: authenticated read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'evidence-files'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "evidence-files: auditee upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'evidence-files'
    AND public.current_user_role() IN ('auditee', 'super_admin')
  );

CREATE POLICY "evidence-files: auditee delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'evidence-files'
    AND public.current_user_role() IN ('auditee', 'super_admin')
  );

-- ── 5. Seed Units ─────────────────────────────────────────────
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

-- ── 6. Seed instrument_components — INSERT...SELECT per baris ──
-- (Tanpa DO $$ block — kompatibel penuh dengan Supabase SQL Editor)

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

-- =============================================================
-- SELESAI — Fase 3 Database Ready
-- =============================================================
