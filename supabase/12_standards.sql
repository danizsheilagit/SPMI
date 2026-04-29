-- ================================================================
-- QASYS — Modul Standar
-- Dokumen rujukan untuk penyusunan instrumen AMI
-- ================================================================

-- 1. Tabel standar
CREATE TABLE IF NOT EXISTS public.standards (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code             VARCHAR(30) NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  description      TEXT,
  category         VARCHAR(100) NOT NULL DEFAULT 'Umum',
  pdf_storage_path TEXT,
  sort_order       INT         NOT NULL DEFAULT 0,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS
ALTER TABLE public.standards ENABLE ROW LEVEL SECURITY;

-- Semua user yang terautentikasi bisa membaca
CREATE POLICY "standards: authenticated can read"
  ON public.standards FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- Super admin bisa full CRUD
CREATE POLICY "standards: super_admin full access"
  ON public.standards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- 3. Storage bucket untuk PDF standar
INSERT INTO storage.buckets (id, name, public)
VALUES ('standard-docs', 'standard-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated bisa baca, super_admin bisa upload/delete
CREATE POLICY "standard-docs: authenticated read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'standard-docs' AND auth.role() = 'authenticated');

CREATE POLICY "standard-docs: super_admin write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'standard-docs' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "standard-docs: super_admin delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'standard-docs' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 4. Data awal (opsional — contoh)
INSERT INTO public.standards (code, name, category, description, sort_order) VALUES
  ('SN-01', 'SN-Dikti: Standar Kompetensi Lulusan',    'Pendidikan',  'Permendikbudristek No. 53 Tahun 2023 tentang Penjaminan Mutu Pendidikan Tinggi', 1),
  ('SN-02', 'SN-Dikti: Standar Isi Pembelajaran',       'Pendidikan',  'Standar isi pembelajaran sesuai SN-Dikti', 2),
  ('SN-03', 'SN-Dikti: Standar Proses Pembelajaran',    'Pendidikan',  'Standar proses pembelajaran sesuai SN-Dikti', 3),
  ('SN-04', 'SN-Dikti: Standar Penilaian Pembelajaran', 'Pendidikan',  'Standar penilaian pembelajaran sesuai SN-Dikti', 4),
  ('SN-05', 'SN-Dikti: Standar Penelitian',             'Penelitian',  'Standar penelitian sesuai SN-Dikti', 5),
  ('SN-06', 'SN-Dikti: Standar PKM',                    'PKM',         'Standar pengabdian kepada masyarakat sesuai SN-Dikti', 6)
ON CONFLICT (code) DO NOTHING;

-- Verifikasi
SELECT id, code, name, category FROM public.standards ORDER BY sort_order;
