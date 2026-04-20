-- ================================================================
-- QASYS — Auditor sebagai fungsi tambahan, bukan role utama
-- Setiap user bisa diaktifkan sebagai auditor via is_auditor flag
-- ================================================================

-- 1. Tambah kolom is_auditor ke profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_auditor BOOLEAN NOT NULL DEFAULT false;

-- 2. Verifikasi kolom berhasil ditambahkan
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'profiles'
  AND column_name  = 'is_auditor';
