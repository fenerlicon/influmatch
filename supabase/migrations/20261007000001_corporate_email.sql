-- ==============================================================================
-- KURUMSAL E-POSTA (ŞİRKET ALAN ADI) DOĞRULAMASI
--
-- Markalar şirket web sitesinin alan adına ait bir e-posta girer ve gönderilen kodla
-- doğrular. Resmi İşletme (sarı tik) için hem vergi numarası onayı hem de doğrulanmış
-- kurumsal e-posta gerekir (lib/official-business.ts).
--
-- 1. users.corporate_email / corporate_email_verified_at: istemci rolleri bu kolonları
--    okuyamaz ve değiştiremez (kolon bazlı okuma yetkisi ve beyaz liste triggerı);
--    sadece sunucu yazar. Web sitesi değişince doğrulama düşer (users_before_update_guard).
-- 2. corporate_email_verifications: bekleyen doğrulama kodları (özetlenmiş), sadece sunucu.
--
-- Supabase SQL Editor uyumu: DECLARE yok, yorumlarda tek tırnak yok, soru işareti yok.
-- ==============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS corporate_email text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS corporate_email_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.corporate_email_verifications (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  send_count integer NOT NULL DEFAULT 1,
  send_window_started_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.corporate_email_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.corporate_email_verifications FROM anon, authenticated;
GRANT ALL ON public.corporate_email_verifications TO service_role;
