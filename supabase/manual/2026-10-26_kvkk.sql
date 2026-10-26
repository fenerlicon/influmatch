-- ELLE CALISTIRILACAK (Supabase SQL Editor, tek seferde). Migration 20261026000050 ile ayni icerik.
-- Bu oturumda Supabase baglantisi yetkisizdi; canliya uygulanmadi. Eklemeli ve tekrar calistirilabilir.
-- Kontrol (calistirdiktan sonra):
--   public.consent_records ve public.privacy_audit_log tablolari var, ikisinde de RLS acik (relrowsecurity = true),
--   pg_trigger tablosunda on_auth_user_consent satiri var.
-- Calistirilana kadar kod calisir; yalnizca riza ve erisim kayitlari tutulmaz, veri indirme hiz siniri bellekte kalir.

-- KVKK teknik altyapi (2026-10-26, docs/KVKK.md, SYSTEM_MAP 14):
-- 1) consent_records: kim, ne zaman, hangi metin surumune, hangi izni verdi / geri aldi
--    (kayitta kosullar + gizlilik onayi, istege bagli cerezler, pazarlama e-postasi).
-- 2) privacy_audit_log: admin hassas belge goruntulemeleri (vergi levhasi, ekler, gorev kanitlari)
--    ve kullanicinin kendi veri indirmeleri (hiz siniri bu kayittan okunur).
-- 3) auth.users uzerinde AFTER INSERT tetikleyici: kayit formundaki onay (metadata legal_consent_version)
--    sunucu saatiyle consent_records tablosuna yazilir. Kaydi asla engellemez.
-- Eklemeli degisiklik: yeni tablolar istemci rollerine tamamen kapali (okuma ve yazma yalnizca service role).
-- Yalnizca kendi tetikleyicisi icin DROP TRIGGER IF EXISTS; veri silme yok. Kod tablolar yokken de calisir (kayit atlanir).

-- 1) Riza kayitlari
CREATE TABLE IF NOT EXISTS public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('terms_privacy', 'cookies_optional', 'marketing_email')),
  granted boolean NOT NULL,
  version text CHECK (version IS NULL OR char_length(version) <= 40),
  source text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'mobile')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.consent_records FROM anon, authenticated;
REVOKE SELECT ON public.consent_records FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS consent_records_user_kind_idx ON public.consent_records (user_id, kind, created_at DESC);

-- 2) Hassas erisim gunlugu
CREATE TABLE IF NOT EXISTS public.privacy_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('tax_document_view', 'attachment_view', 'task_proof_view', 'data_export')),
  resource_id text CHECK (resource_id IS NULL OR char_length(resource_id) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.privacy_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.privacy_audit_log FROM anon, authenticated;
REVOKE SELECT ON public.privacy_audit_log FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS privacy_audit_log_actor_idx ON public.privacy_audit_log (actor_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS privacy_audit_log_subject_idx ON public.privacy_audit_log (subject_user_id, created_at DESC);

-- 3) Kayit aninda onay kaydi (web: lib/consent-shared.ts LEGAL_CONSENT_VERSION, mobil: constants/consent.js)
CREATE OR REPLACE FUNCTION public.record_signup_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $f$
BEGIN
  IF coalesce(NEW.raw_user_meta_data ->> 'legal_consent_version', '') <> '' THEN
    INSERT INTO public.consent_records (user_id, kind, granted, version, source)
    VALUES (
      NEW.id,
      'terms_privacy',
      true,
      left(NEW.raw_user_meta_data ->> 'legal_consent_version', 40),
      CASE WHEN NEW.raw_user_meta_data ->> 'signup_source' = 'mobile' THEN 'mobile' ELSE 'web' END
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END
$f$;
REVOKE EXECUTE ON FUNCTION public.record_signup_consent() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_consent ON auth.users;
CREATE TRIGGER on_auth_user_consent AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.record_signup_consent();
