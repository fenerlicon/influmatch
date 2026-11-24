-- Telefon numarasi (kullanici karari 2026-11-24): acil durumda (or. marka influencer'a yazarak ulasamiyor) yalnizca platformun
-- ulasabilecegi numara. Influencer, UGC ve marka icin zorunlu; yalnizca kullanicinin kendisi (sunucu uzerinden) ve admin gorur.
-- Pazarlama (SMS / arama) izni ayri ve istege bagli: consent_records 'marketing_sms'.
-- Yeni tablo + kisit genisletme (risksiz, CLAUDE.md kural 4). Tablo istemcilere tamamen kapali; okuma/yazma service role.
CREATE TABLE IF NOT EXISTS public.user_contacts (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  phone text NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  -- SMS dogrulamasi saglayici secilince doldurulur (bugun bos).
  phone_verified_at timestamptz,
  marketing_sms boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_contacts FROM anon, authenticated;

ALTER TABLE public.consent_records DROP CONSTRAINT IF EXISTS consent_records_kind_check;
ALTER TABLE public.consent_records
  ADD CONSTRAINT consent_records_kind_check CHECK (kind IN ('terms_privacy', 'cookies_optional', 'marketing_email', 'marketing_sms'));
