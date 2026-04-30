-- ================================================================
-- QASYS Migration 16 — Pengumuman (Announcements)
-- ================================================================

-- ── 1. Tabel announcements ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  content      TEXT,                          -- body teks (opsional)
  pdf_url      TEXT,                          -- URL dari Supabase Storage
  pdf_name     TEXT,                          -- nama file asli
  is_active    BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- ── 2. RLS Policies ───────────────────────────────────────────
-- Super Admin + Kepala LPMPP bisa CRUD
DROP POLICY IF EXISTS "announcements: admin manage" ON public.announcements;
CREATE POLICY "announcements: admin manage" ON public.announcements
  FOR ALL
  USING  ( public.current_user_role() IN ('super_admin', 'kepala_lpmpp') )
  WITH CHECK ( public.current_user_role() IN ('super_admin', 'kepala_lpmpp') );

-- Auditor, Auditee, Pimpinan hanya bisa baca yang aktif
DROP POLICY IF EXISTS "announcements: read active" ON public.announcements;
CREATE POLICY "announcements: read active" ON public.announcements
  FOR SELECT
  USING ( is_active = true AND auth.role() = 'authenticated' );

-- ── 3. Storage bucket untuk PDF lampiran ──────────────────────
-- Jalankan di Supabase Dashboard → Storage jika belum ada:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('announcements', 'announcements', true)
-- ON CONFLICT DO NOTHING;

-- Storage RLS (public read, admin write)
-- Di Supabase Dashboard → Storage → announcements → Policies:
-- SELECT: true (public)
-- INSERT/UPDATE/DELETE: role IN ('super_admin','kepala_lpmpp')

-- ── 4. Verifikasi ─────────────────────────────────────────────
SELECT COUNT(*) as announcements_table FROM public.announcements;
