-- Yol haritasi adim 2 (2026-10-10): cevapsiz teklif suresi, teklif sablonlari, kaydedilen ilanlar ve ilan alarmlari.
-- Eklemeli degisiklik: CHECK genisletme, tetikleyici fonksiyonunda istemci icin daraltma, yeni tablolar (RLS acik,
-- istemcilere yalnizca sahibine SELECT), indeksler. Yazimlarin hepsi sunucu kodundan (service role) yetki kontrolunden sonra.
-- Her tablo, RLS ve yetki geri almasi ile ayni blokta olusturulur (tablo bir an bile acik kalmasin).
-- Politikalar DROP POLICY olmadan, yoksa olusturulur (canlida DROP POLICY onay bekleyip zaman asimina ugruyor).

-- 1) Teklif suresi -------------------------------------------------------------------------------

ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_status_check,
  ADD CONSTRAINT offers_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'expired'::text]));

-- Saatlik gorev bekleyen eski teklifleri bu indeksle bulur.
CREATE INDEX IF NOT EXISTS idx_offers_pending_created_at ON public.offers USING btree (created_at) WHERE status = 'pending';

-- Istemci (authenticated) tarafinda: kesinlesmis veya suresi dolmus teklif degismez; 7 gunu gecen bekleyen
-- teklif kabul/red edilemez; istemci durumu expired yapamaz (bunu yalnizca saatlik gorev yapar).
CREATE OR REPLACE FUNCTION public.secure_offers_final()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF OLD.status IN ('accepted', 'rejected', 'expired')
       OR (OLD.status = 'pending' AND OLD.created_at < now() - interval '7 days') THEN
      NEW.budget = OLD.budget;
      NEW.message = OLD.message;
      NEW.campaign_name = OLD.campaign_name;
      NEW.status = OLD.status;
      RETURN NEW;
    END IF;

    IF NEW.status = 'expired' THEN
      NEW.status = OLD.status;
    END IF;

    -- Gonderen marka durumu degistiremez; alici influencer teklifin icerigini degistiremez.
    IF auth.uid() = OLD.sender_user_id THEN
      NEW.status = OLD.status;
    END IF;
    IF auth.uid() = OLD.receiver_user_id THEN
      NEW.budget = OLD.budget;
      NEW.message = OLD.message;
      NEW.campaign_name = OLD.campaign_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Teklif sablonlari ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.offer_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  campaign_name text NOT NULL CHECK (char_length(campaign_name) BETWEEN 1 AND 120),
  campaign_type text CHECK (campaign_type IS NULL OR char_length(campaign_type) <= 40),
  budget numeric CHECK (budget IS NULL OR (budget >= 0 AND budget <= 100000000)),
  payment_type text NOT NULL DEFAULT 'cash' CHECK (payment_type IN ('cash', 'barter')),
  message text CHECK (message IS NULL OR char_length(message) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_templates_brand_name_key UNIQUE (brand_id, name)
);
ALTER TABLE public.offer_templates ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.offer_templates FROM anon, authenticated;
REVOKE SELECT ON public.offer_templates FROM anon;
GRANT SELECT ON public.offer_templates TO authenticated;

DO $p$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'offer_templates' AND policyname = 'offer_templates select owner') THEN
    CREATE POLICY "offer_templates select owner" ON public.offer_templates AS PERMISSIVE FOR SELECT TO authenticated
      USING (brand_id = (SELECT auth.uid()));
  END IF;
END
$p$;

-- 3) Kaydedilen ilanlar --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.saved_adverts (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  advert_id uuid NOT NULL REFERENCES public.advert_projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, advert_id)
);
ALTER TABLE public.saved_adverts ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.saved_adverts FROM anon, authenticated;
REVOKE SELECT ON public.saved_adverts FROM anon;
GRANT SELECT ON public.saved_adverts TO authenticated;

CREATE INDEX IF NOT EXISTS idx_saved_adverts_advert_id ON public.saved_adverts USING btree (advert_id);

DO $p$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'saved_adverts' AND policyname = 'saved_adverts select owner') THEN
    CREATE POLICY "saved_adverts select owner" ON public.saved_adverts AS PERMISSIVE FOR SELECT TO authenticated
      USING (user_id = (SELECT auth.uid()));
  END IF;
END
$p$;

-- 4) Ilan alarmlari ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.advert_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category text CHECK (category IS NULL OR char_length(category) BETWEEN 1 AND 60),
  platform text CHECK (platform IS NULL OR platform IN ('instagram', 'tiktok', 'youtube')),
  min_budget integer CHECK (min_budget IS NULL OR min_budget BETWEEN 1 AND 100000000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.advert_alerts ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.advert_alerts FROM anon, authenticated;
REVOKE SELECT ON public.advert_alerts FROM anon;
GRANT SELECT ON public.advert_alerts TO authenticated;

CREATE INDEX IF NOT EXISTS idx_advert_alerts_user_id ON public.advert_alerts USING btree (user_id);

DO $p$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'advert_alerts' AND policyname = 'advert_alerts select owner') THEN
    CREATE POLICY "advert_alerts select owner" ON public.advert_alerts AS PERMISSIVE FOR SELECT TO authenticated
      USING (user_id = (SELECT auth.uid()));
  END IF;
END
$p$;

-- Hangi ilan alarmlarla eslestirildi (yalnizca sunucu; istemcilere hic acik degil).
CREATE TABLE IF NOT EXISTS public.advert_alert_runs (
  advert_id uuid PRIMARY KEY REFERENCES public.advert_projects(id) ON DELETE CASCADE,
  processed_at timestamptz NOT NULL DEFAULT now(),
  matched integer NOT NULL DEFAULT 0,
  notified integer NOT NULL DEFAULT 0
);
ALTER TABLE public.advert_alert_runs ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.advert_alert_runs FROM anon, authenticated;
REVOKE SELECT ON public.advert_alert_runs FROM anon, authenticated;

-- Yeni ilan taramasi icin.
CREATE INDEX IF NOT EXISTS idx_advert_projects_open_created_at ON public.advert_projects USING btree (created_at) WHERE status = 'open';

-- Dogrulama
SELECT
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'offers_status_check') AS offers_status_check,
  (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('offer_templates', 'saved_adverts', 'advert_alerts', 'advert_alert_runs') AND rowsecurity) AS rls_tables;
