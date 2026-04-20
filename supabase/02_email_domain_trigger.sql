-- =============================================================
-- QASYS — Email Domain Restriction (Versi Alternatif)
-- TANPA menyentuh skema auth (yang dikunci Supabase)
--
-- Strategi: Block di level public.profiles dengan CHECK CONSTRAINT
-- + validasi sisi client di AuthCallback.jsx
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- ⚙️  KONFIGURASI — Ganti domain di sini jika berubah
-- ─────────────────────────────────────────────────────────────
-- Domain yang diizinkan (digunakan di function & constraint)
-- ─────────────────────────────────────────────────────────────

-- 1. Fungsi validasi domain (di skema PUBLIC — diizinkan)
CREATE OR REPLACE FUNCTION public.is_allowed_email_domain(email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  -- ⚙️ Ganti domain di sini:
  allowed_domain CONSTANT TEXT := 'stikomyos.ac.id';
BEGIN
  RETURN LOWER(SPLIT_PART(LOWER(TRIM(email)), '@', 2)) = allowed_domain;
END;
$$;

-- 2. Check constraint pada tabel profiles
--    Jika user berhasil masuk tapi domain salah,
--    insert ke profiles akan GAGAL → user tidak punya akses ke sistem.
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_email_domain
  CHECK (public.is_allowed_email_domain(email));

-- 3. Update trigger handle_new_user agar melempar error yang jelas
--    (Override fungsi yang sudah dibuat di 01_schema.sql)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  allowed_domain CONSTANT TEXT := 'stikomyos.ac.id';
  user_email TEXT;
  user_domain TEXT;
BEGIN
  user_email := LOWER(TRIM(NEW.email));
  user_domain := SPLIT_PART(user_email, '@', 2);

  -- Validasi domain sebelum insert ke profiles
  IF user_domain <> allowed_domain THEN
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

-- Pastikan trigger sudah terpasang (idempotent):
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- SELESAI
-- Lapisan proteksi:
-- [1] Client-side: AuthCallback.jsx memeriksa domain → auto sign-out
-- [2] Database: handle_new_user trigger tidak insert ke profiles
-- [3] Database: CHECK CONSTRAINT pada kolom email di profiles
-- [4] RLS: tanpa profil, user tidak bisa akses tabel apapun
-- ─────────────────────────────────────────────────────────────
