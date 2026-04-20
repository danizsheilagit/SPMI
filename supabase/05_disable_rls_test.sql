-- =============================================================
-- QASYS — Fix: Disable RLS on profiles (isolasi masalah)
-- Setelah ini refresh browser, jika load → masalah ada di RLS.
-- =============================================================

-- Matikan RLS sementara untuk isolasi masalah
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Verifikasi
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'profiles';
