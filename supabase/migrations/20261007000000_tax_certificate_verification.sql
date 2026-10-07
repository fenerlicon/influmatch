-- ==============================================================================
-- VERGİ LEVHASI DOĞRULAMA
--
-- Marka vergi levhasını (PDF veya fotoğraf) yükler; sunucu PDF metnini kendi içinde okur
-- (hiçbir dış servise veya yapay zekaya gönderilmez) ve profildeki vergi bilgileriyle
-- karşılaştırır. Tüm kontroller geçerse vergi numarası otomatik onaylanır, aksi halde
-- admin incelemesine düşer. Fotoğraf ve taramalar doğrudan admin incelemesine düşer.
--
-- 1. tax-documents: gizli depolama alanı. Kullanıcı sadece kendi klasörüne yükleyebilir,
--    okuyamaz/silemez. Belgeleri sadece sunucu (service role) okur; admin ekranı
--    kısa süreli imzalı bağlantı kullanır.
-- 2. tax_verifications: her yüklemenin sonucu. Kullanıcı kendi kayıtlarını okuyabilir,
--    yazamaz. Kayıtları sadece sunucu yazar.
--
-- Supabase SQL Editor uyumu: DECLARE yok, yorumlarda tek tırnak yok.
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tax-documents',
  'tax-documents',
  false,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Brands upload their own tax documents" ON storage.objects;
CREATE POLICY "Brands upload their own tax documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tax-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE TABLE IF NOT EXISTS public.tax_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_type text,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'auto_approved', 'needs_review', 'approved', 'rejected')),
  submitted_tax_id text,
  submitted_legal_name text,
  submitted_tax_office text,
  submitted_city text,
  extracted jsonb,
  checks jsonb,
  reasons text[] NOT NULL DEFAULT '{}',
  model text,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_verifications_user ON public.tax_verifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tax_verifications_status ON public.tax_verifications (status) WHERE status = 'needs_review';

ALTER TABLE public.tax_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tax_verifications FROM anon, authenticated;
GRANT SELECT ON public.tax_verifications TO authenticated;
GRANT ALL ON public.tax_verifications TO service_role;

DROP POLICY IF EXISTS "Users read their own tax verifications" ON public.tax_verifications;
CREATE POLICY "Users read their own tax verifications"
ON public.tax_verifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
