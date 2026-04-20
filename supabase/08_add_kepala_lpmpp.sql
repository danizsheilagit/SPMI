-- =============================================================
-- QASYS — Tambah role kepala_lpmpp ke enum user_role
-- =============================================================

-- Tambah nilai baru ke enum (tidak bisa di-rollback, hati-hati)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'kepala_lpmpp';

-- Verifikasi enum sekarang
SELECT enumlabel
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'user_role'
ORDER BY enumsortorder;
